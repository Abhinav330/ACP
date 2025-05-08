import json
import subprocess
import sys
import os

def test_pandas_executor():
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Read test input
    with open(os.path.join(current_dir, 'test_input.json'), 'r') as f:
        test_input = f.read()
    
    print("Sending test input:", test_input)
    print("\n" + "="*50 + "\n")

    # Run the executor with the test input
    process = subprocess.Popen(
        [sys.executable, os.path.join(current_dir, 'pandas_executor.py')],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Send input and get output
    stdout, stderr = process.communicate(input=test_input)

    # Print debug output first
    if stderr:
        print("Debug Output:")
        print("=" * 50)
        print(stderr)
        print("=" * 50 + "\n")

    # Print the results
    print("\nTest Results:")
    print("=" * 50)
    
    try:
        results = json.loads(stdout)
        for i, result in enumerate(results.get('results', []), 1):
            print(f"\nTest Case {i}:")
            print(f"Passed: {result['passed']}")
            if result['error']:
                print(f"Error: {result['error']}")
            print(f"Output: {result['output']}")
            print(f"Expected: {result['expected']}")
    except json.JSONDecodeError:
        print("Error parsing output:")
        print(stdout)

if __name__ == '__main__':
    test_pandas_executor() 