
# Project Setup Guide

This guide will walk you through the setup process to get the project running.

## Steps to Get Started

### 1. Create Account in Deepnote
   - Visit [Deepnote](https://www.deepnote.com/) and sign up for an account if you don’t already have one.

### 2. Install Ollama via Terminal
   To install Ollama, open your terminal and run the following command:

   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

   This will download and install Ollama on your system.
   Then download necessary model as required. Refer to https://ollama.com/search for details.
    
   ```bash
      ollama run gemma3:1b
   ```
   Add your origins here
   ```bash
   OLLAMA_ORIGINS="https://7bc0ab74-f100-4960-b285-dc5686265703.deepnoteproject.com,http://127.0.0.1,http://127.0.0.1/*,https://*,http://*,http://localhost,https://localhost,http://127.0.0.1,https://127.0.0.1,http://0.0.0.0,https://0.0.0.0" ollama serve
   ```

### 3. Save Files in Folder
   - Ensure that all project files are saved in the appropriate folder for your project.

### 4. Run the Application
   After completing the setup, you can run the application by executing the following command in your terminal:

   ```bash
   python app.py
   ```

   This will start the application, and you can access it as needed.

---

## Additional Information

For more information about Ollama installation, you can refer to their official installation page by visiting this link:

[Ollama Installation Guide](https://ollama.com/install.sh)

You can access the project at the following URL for reference:

[Deepnote Project](https://7bc0ab74-f100-4960-b285-dc5686265703.deepnoteproject.com/)

**Note:** The project link will be available for **15 minutes** only.

```

This includes your Deepnote project URL and the time limitation note.
