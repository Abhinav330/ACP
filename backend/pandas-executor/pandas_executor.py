import sys
import json
import pandas as pd
import numpy as np
import io
from contextlib import redirect_stdout
import traceback
import signal
import time
import psutil
import os

# Constants
EXECUTION_TIMEOUT = 25  # seconds
MAX_MEMORY_USAGE = 512  # MB


class TimeoutError(Exception):
    pass


def timeout_handler(signum, frame):
    raise TimeoutError("Execution time limit reached")


def format_output(passed: bool, error: str=None, output: str=None, expected: str=None, execution_time: float=None) -> dict:
    """Format the output in a consistent way"""
    return {
        'passed': passed,
        'error': error,
        'output': output,
        'expected': expected,
        'execution_time': execution_time
    }


def format_result_for_comparison(result) -> tuple[str, any]:
    """Convert any result type to a comparable string format"""
    try:
        if isinstance(result, pd.DataFrame):
            return 'dataframe', result.to_dict('list')
        elif isinstance(result, pd.Series):
            return 'series', result.to_dict()
        elif isinstance(result, np.ndarray):
            return 'ndarray', result.tolist()
        elif isinstance(result, (list, dict, str, int, float, bool)):
            return 'basic', result
        elif result is None:
            return 'none', None
        else:
            return 'string', str(result)
    except Exception as e:
        return 'error', f"Error formatting result: {str(e)}"


def check_memory_usage():
    """Check if memory usage exceeds the limit"""
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    memory_usage_mb = memory_info.rss / 1024 / 1024  # Convert to MB
    if memory_usage_mb > MAX_MEMORY_USAGE:
        raise MemoryError(f"Memory usage ({memory_usage_mb:.2f}MB) exceeded limit of {MAX_MEMORY_USAGE}MB")


def execute_function(code: str, function_name: str, test_input: str) -> tuple[tuple[str, any], str, float]:
    """Execute a function and return its result"""
    start_time = time.time()
    try:
        # Set up timeout handler
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(EXECUTION_TIMEOUT)
        
        # Convert input string to dictionary and create DataFrame
        test_input = test_input.replace('nan', 'float("nan")')
        input_dict = eval(test_input, {'float': float, 'nan': float('nan')})
        df = pd.DataFrame(input_dict)
        
    # Create a namespace for execution
    namespace = {
        'pd': pd,
        'np': np,
            'df': df
    }
    
    # Execute the function definition
        exec(code, namespace)
    
    # Capture the output
    output_buffer = io.StringIO()
        with redirect_stdout(output_buffer):
            try:
                # Check memory before execution
                check_memory_usage()
                
            # Call the function with the input DataFrame
                result = namespace[function_name](df)
                
                # Check memory after execution
                check_memory_usage()
                
                # Convert result to comparable format
                result_type, formatted_result = format_result_for_comparison(result)
                
                # Disable alarm
                signal.alarm(0)
                
                return (result_type, formatted_result), None, time.time() - start_time
        except TimeoutError:
            signal.alarm(0)  # Disable alarm
            return None, f"Execution time limit of {EXECUTION_TIMEOUT} seconds reached", time.time() - start_time
        except MemoryError as e:
            signal.alarm(0)  # Disable alarm
            return None, str(e), time.time() - start_time
        except Exception as e:
            signal.alarm(0)  # Disable alarm
            return None, f'Error executing function: {str(e)}', time.time() - start_time
    except Exception as e:
        signal.alarm(0)  # Disable alarm
        return None, f'Error preparing input DataFrame: {str(e)}', time.time() - start_time


def compare_results(type1: str, result1: any, type2: str, result2: any) -> tuple[bool, str]:
    """Compare two results and return if they match and any error message"""
    try:
        if type1 != type2:
            return False, f"Return type mismatch. Expected {type2}, got {type1}"
            
        if type1 == 'dataframe':
            # Compare DataFrames
            if set(result1.keys()) != set(result2.keys()):
                return False, f"Column mismatch. Expected columns: {list(result2.keys())}, Got: {list(result1.keys())}"
            
            for key in result2:
                expected_values = result2[key]
                actual_values = result1[key]
                
                if len(expected_values) != len(actual_values):
                    return False, f"Length mismatch for column '{key}'. Expected {len(expected_values)} rows, got {len(actual_values)}"
                
                for i, (exp, act) in enumerate(zip(expected_values, actual_values)):
                    if pd.isna(exp) and pd.isna(act):
                        continue
                    if exp != act:
                        return False, f"Value mismatch in column '{key}' at row {i}. Expected {exp}, got {act}"
            
            return True, None
            
        elif type1 == 'series':
            if set(result1.keys()) != set(result2.keys()):
                return False, f"Index mismatch. Expected: {list(result2.keys())}, Got: {list(result1.keys())}"
            
            for key in result2:
                if pd.isna(result1[key]) and pd.isna(result2[key]):
                    continue
                if result1[key] != result2[key]:
                    return False, f"Value mismatch at index {key}. Expected {result2[key]}, got {result1[key]}"
            
            return True, None
            
        elif type1 == 'ndarray':
            if len(result1) != len(result2):
                return False, f"Length mismatch. Expected length {len(result2)}, got {len(result1)}"
            
            for i, (exp, act) in enumerate(zip(result2, result1)):
                if np.isnan(exp) and np.isnan(act):
                    continue
                if exp != act:
                    return False, f"Value mismatch at index {i}. Expected {exp}, got {act}"
            
            return True, None
            
        else:
            # For basic types, direct comparison
            if result1 == result2:
                return True, None
            else:
                return False, f"Value mismatch. Expected {result2}, got {result1}"
            
    except Exception as e:
        return False, f"Error comparing results: {str(e)}"


def run_test_case(user_code: str, working_code: str, test_input: str) -> dict:
    try:
        # Get the function names
        user_function_name = None
        working_function_name = None
        
        for line in user_code.split('\n'):
            if line.startswith('def '):
                user_function_name = line[4:line.index('(')]
                break
        
        for line in working_code.split('\n'):
            if line.startswith('def'):
                working_function_name = line[4:line.index('(')]
                break
                
        if not user_function_name:
            return format_output(False, error='No function definition found in user code')
        if not working_function_name:
            return format_output(False, error='No function definition found in working code')
        
        # Execute working code to get expected output
        working_result, working_error, working_time = execute_function(working_code, working_function_name, test_input)
        if working_error:
            return format_output(False, error=f'Error in working code: {working_error}')
        
        # Execute user code
        user_result, user_error, user_time = execute_function(user_code, user_function_name, test_input)
        if user_error:
            return format_output(False, error=user_error, execution_time=user_time)
            
        if not user_result:
            return format_output(False, error="No output produced by the function", execution_time=user_time)
        
        # Compare results
        user_type, user_formatted = user_result
        working_type, working_formatted = working_result
        
        matches, error_msg = compare_results(user_type, user_formatted, working_type, working_formatted)
        
        if matches:
            return format_output(True, output=str(user_formatted), expected=str(working_formatted), execution_time=user_time)
        else:
            return format_output(False, error=error_msg, output=str(user_formatted), expected=str(working_formatted), execution_time=user_time)
        
    except Exception as e:
        error_msg = f"Error: {str(e)}\n{traceback.format_exc()}"
        return format_output(False, error=error_msg)


def main():
    try:
        # Read input JSON
        input_json = sys.stdin.readline().strip()
        if not input_json:
            print(json.dumps({'results': [format_output(False, error="No input received")]}))
            return
            
        try:
            input_data = json.loads(input_json)
        except json.JSONDecodeError as e:
            print(json.dumps({'results': [format_output(False, error=f"Invalid JSON input: {str(e)}")]}))
            return
        
        if 'code' not in input_data:
            print(json.dumps({'results': [format_output(False, error="No code provided in input")]}))
            return
            
        if 'test_cases' not in input_data:
            print(json.dumps({'results': [format_output(False, error="No test cases provided in input")]}))
            return
            
        if 'working_driver' not in input_data:
            print(json.dumps({'results': [format_output(False, error="No working driver provided in input")]}))
            return
            
        results = []
        for test_case in input_data['test_cases']:
            result = run_test_case(
                input_data['code'],
                input_data['working_driver'],
                test_case['input']
            )
            results.append(result)
        
        print(json.dumps({'results': results}))
        
    except Exception as e:
        print(json.dumps({'results': [format_output(False, error=f"Unexpected error: {str(e)}")]}))


if __name__ == '__main__':
    main()
