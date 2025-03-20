from flask import Flask, jsonify, render_template, request, Response
from flask_cors import CORS
import requests

app = Flask(__name__)

# Enable CORS for the frontend URL (e.g., Deepnote frontend)
CORS(app, origins="https://7bc0ab74-f100-4960-b285-dc5686265703.deepnoteproject.com")  # Replace with your actual frontend URL

# Route to serve the index.html page
@app.route('/')
def index():
    return render_template('index.html')  # Flask will look for index.html in the templates folder

# API route to get Ollama tags (for the fetch in JS)
@app.route('/api/tags')
def get_ollama_tags():
    try:
        # You might need to change this URL if Ollama is not on localhost
        ollama_url = "http://localhost:11434/api/tags"
        
        # Add a timeout to avoid long waits
        response = requests.get(ollama_url, timeout=5)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot connect to Ollama. Is it running?", 
                        "details": "Ollama server should be running on localhost:11471"}), 503
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Error connecting to Ollama API", 
                        "details": str(e)}), 500

@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        data = request.json
        prompt = data.get('prompt')
        model = data.get('model')
        
        # Stream the response from Ollama
        def generate_stream():
            # Make a streaming request to Ollama
            with requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": True
                },
                stream=True
            ) as ollama_response:
                # Check for errors before streaming
                if ollama_response.status_code != 200:
                    error_msg = f"Ollama API error: {ollama_response.status_code}"
                    yield json.dumps({"error": error_msg}) + "\n"
                    return
                
                # Stream each chunk of the response directly
                for line in ollama_response.iter_lines():
                    if line:
                        # Just forward the JSON line without the data: prefix
                        yield line.decode('utf-8') + "\n"
        
        # Return a streaming response without SSE formatting
        return Response(generate_stream(), mimetype='application/x-ndjson')
    
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Error generating response: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)