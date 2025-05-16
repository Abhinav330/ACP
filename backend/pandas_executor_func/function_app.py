import azure.functions as func
import json
from safe_executor import run_test_suite

app = func.FunctionApp()

@app.route(route="run_code_executor", auth_level=func.AuthLevel.FUNCTION)
def run_code_executor(req: func.HttpRequest) -> func.HttpResponse:
    try:
        input_json = req.get_json()
        result = run_test_suite(input_json)
        return func.HttpResponse(json.dumps(result), mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=500)
