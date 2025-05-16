import pandas as pd
import numpy as np
import time
import json
import traceback
import psutil
import os
import multiprocessing

# Constants
EXECUTION_TIMEOUT = 25  # seconds
MAX_MEMORY_USAGE = 512  # MB

class TimeoutError(Exception):
    pass

def format_output(passed: bool, error: str = None, output: str = None, expected: str = None, execution_time: float = None) -> dict:
    return {
        'passed': passed,
        'error': error,
        'output': output,
        'expected': expected,
        'execution_time': execution_time
    }

def format_result_for_comparison(result) -> tuple[str, any]:
    try:
        if isinstance(result, pd.DataFrame):
            return 'dataframe', result.to_dict('list')
        elif isinstance(result, pd.Series):
            return 'series', result.to_dict()
        elif isinstance(result, np.ndarray):
            return 'ndarray', result.tolist()
        elif result is None:
            return 'none', None
        elif isinstance(result, (list, dict, str, int, float, bool)):
            return 'basic', result
        else:
            return 'string', str(result)
    except Exception as e:
        return 'error', f"Error formatting result: {str(e)}"

def check_memory_usage():
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    memory_usage_mb = memory_info.rss / 1024 / 1024
    if memory_usage_mb > MAX_MEMORY_USAGE:
        raise MemoryError(f"Memory usage ({memory_usage_mb:.2f}MB) exceeded limit of {MAX_MEMORY_USAGE}MB")

def executor_worker(code, function_name, test_input, conn):
    try:
        test_input = test_input.replace('nan', 'float(\"nan\")')
        input_dict = eval(test_input, {'float': float, 'nan': float('nan')})
        df = pd.DataFrame(input_dict)

        namespace = {
            'pd': pd,
            'np': np,
            'df': df
        }

        exec(code, namespace)
        check_memory_usage()
        result = namespace[function_name](df)
        check_memory_usage()

        result_type, formatted_result = format_result_for_comparison(result)
        conn.send(((result_type, formatted_result), None))
    except Exception as e:
        conn.send((None, f"Function error: {str(e)}"))

def execute_function(code: str, function_name: str, test_input: str) -> tuple[tuple[str, any], str, float]:
    start_time = time.time()
    parent_conn, child_conn = multiprocessing.Pipe()
    process = multiprocessing.Process(target=executor_worker, args=(code, function_name, test_input, child_conn))
    process.start()
    process.join(EXECUTION_TIMEOUT)

    if process.is_alive():
        process.terminate()
        return None, f"Execution timed out after {EXECUTION_TIMEOUT} seconds.", time.time() - start_time

    try:
        result, error = parent_conn.recv()
        return result, error, time.time() - start_time
    except EOFError:
        return None, "No result received from worker process", time.time() - start_time

def compare_results(type1: str, result1: any, type2: str, result2: any) -> tuple[bool, str]:
    try:
        if type1 != type2:
            return False, f"Return type mismatch. Expected {type2}, got {type1}"

        if type1 == 'dataframe':
            if set(result1.keys()) != set(result2.keys()):
                return False, f"Column mismatch. Expected columns: {list(result2.keys())}, Got: {list(result1.keys())}"
            for key in result2:
                if len(result2[key]) != len(result1[key]):
                    return False, f"Length mismatch for column '{key}'."
                for i, (exp, act) in enumerate(zip(result2[key], result1[key])):
                    if pd.isna(exp) and pd.isna(act):
                        continue
                    if exp != act:
                        return False, f"Mismatch in column '{key}' at row {i}: Expected {exp}, got {act}"
            return True, None

        elif type1 == 'series':
            if set(result1.keys()) != set(result2.keys()):
                return False, "Index mismatch in Series."
            for key in result2:
                if pd.isna(result1[key]) and pd.isna(result2[key]):
                    continue
                if result1[key] != result2[key]:
                    return False, f"Mismatch at index {key}: Expected {result2[key]}, got {result1[key]}"
            return True, None

        elif type1 == 'ndarray':
            if len(result1) != len(result2):
                return False, "Length mismatch in array"
            for i, (exp, act) in enumerate(zip(result2, result1)):
                if np.isnan(exp) and np.isnan(act):
                    continue
                if exp != act:
                    return False, f"Array mismatch at index {i}: Expected {exp}, got {act}"
            return True, None

        else:
            return (result1 == result2), None if result1 == result2 else f"Mismatch: Expected {result2}, got {result1}"
    except Exception as e:
        return False, f"Error comparing results: {str(e)}"

def run_test_case(user_code: str, working_code: str, test_input: str) -> dict:
    try:
        def get_func_name(code):
            for line in code.split('\n'):
                if line.strip().startswith('def '):
                    return line.split('def ')[1].split('(')[0].strip()
            return None

        user_fn = get_func_name(user_code)
        working_fn = get_func_name(working_code)

        if not user_fn or not working_fn:
            return format_output(False, error="Function name not found.")

        expected, err1, _ = execute_function(working_code, working_fn, test_input)
        if err1:
            return format_output(False, error=f"Error in working code: {err1}")

        actual, err2, exec_time = execute_function(user_code, user_fn, test_input)
        if err2:
            return format_output(False, error=err2, execution_time=exec_time)

        if not actual:
            return format_output(False, error="No output from user code", execution_time=exec_time)

        u_type, u_result = actual
        w_type, w_result = expected
        match, compare_error = compare_results(u_type, u_result, w_type, w_result)

        return format_output(
            passed=match,
            error=compare_error if not match else None,
            output=str(u_result),
            expected=str(w_result),
            execution_time=exec_time
        )
    except Exception as e:
        return format_output(False, error=f"Unhandled error: {str(e)}\n{traceback.format_exc()}")

def run_test_suite(input_data: dict) -> dict:
    try:
        if 'code' not in input_data or 'working_driver' not in input_data or 'test_cases' not in input_data:
            return {'results': [format_output(False, error="Missing required fields")]}

        results = []
        for test_case in input_data['test_cases']:
            results.append(run_test_case(
                input_data['code'],
                input_data['working_driver'],
                test_case['input']
            ))
        return {'results': results}
    except Exception as e:
        return {'results': [format_output(False, error=f"Unexpected error: {str(e)}")]}
