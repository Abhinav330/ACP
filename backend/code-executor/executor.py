import sys
import json
import traceback
import re
from typing import List, Dict, Any
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

def normalize_string(s: str) -> str:
    """Normalize a string by removing extra whitespace and standardizing line endings."""
    # First, standardize all line endings to \n
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    
    # Split into lines, strip each line, and remove empty lines
    lines = [line.strip() for line in s.split('\n')]
    lines = [line for line in lines if line]
    
    # Standardize multiple spaces to single space within each line
    lines = [re.sub(r'\s+', ' ', line) for line in lines]
    
    # Join with single newlines
    return '\n'.join(lines)

def run_test_case(code: str, test_input: str, expected_output: str) -> Dict[str, Any]:
    """Run a single test case and return the result."""
    output_buffer = StringIO()
    error_buffer = StringIO()
    
    try:
        # Split input into lines and create an input simulator
        input_lines = test_input.strip().split('\n')
        input_iter = iter(input_lines)
        
        def input_simulator(*args):
            try:
                return next(input_iter)
            except StopIteration:
                raise EOFError("No more input available")
        
        # Prepare the namespace for execution
        namespace = {'input': input_simulator}
        
        # Execute the user's code
        with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
            exec(code, namespace)
            
        # Get and normalize the output
        actual_output = normalize_string(output_buffer.getvalue())
        expected_output = normalize_string(expected_output)
        
        # Compare outputs
        passed = actual_output == expected_output
            
        return {
            "status": "success",
            "passed": passed,
            "actual_output": actual_output,
            "expected_output": expected_output,
            "error": None
        }
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        return {
            "status": "error",
            "passed": False,
            "actual_output": None,
            "expected_output": expected_output,
            "error": error_msg
        }

def compare_outputs(expected: str, actual: str) -> bool:
    """Compare two strings after normalizing them."""
    return normalize_string(expected) == normalize_string(actual)

def main():
    try:
        # Read input data
        input_str = sys.stdin.read().strip()
        
        if not input_str:
            raise ValueError("No input received")

        # Parse input data
        input_data = json.loads(input_str)
        code = input_data.get('code')
        test_cases = input_data.get('test_cases', [])

        if not code:
            raise ValueError("No code provided")
        if not test_cases:
            raise ValueError("No test cases provided")

        # Run each test case
        results = []
        for i, test_case in enumerate(test_cases, 1):
            result = run_test_case(
                code=code,
                test_input=test_case['input'],
                expected_output=test_case['expected_output']
            )
            result['test_case_number'] = i
            results.append(result)
        
        # Return results
        output = {
            "status": "success",
            "results": results
        }
        print(json.dumps(output, ensure_ascii=False), flush=True)
        
    except Exception as e:
        error_output = {
            "status": "error",
            "error": str(e),
            "results": []
        }
        print(json.dumps(error_output, ensure_ascii=False), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
