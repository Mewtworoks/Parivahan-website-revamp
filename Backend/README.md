# 🐍 Backend - Parivahan Website Revamp (Python)

This directory contains the Python backend API service built with **FastAPI** / **Uvicorn**.

## 🛠️ Prerequisites
- Python 3.9+ installed on system.

## 🚀 Setup & Run Instructions for Backend Developer

1. **Navigate to Backend Directory**:
   ```bash
   cd Backend
   ```

2. **Create & Activate Virtual Environment**:
   - **Windows**:
     ```bash
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start API Server**:
   ```bash
   python main.py
   ```
   *The server will run on `http://127.0.0.1:8000` with automatic live reloading enabled.*

5. **API Documentation**:
   - Interactive Swagger Docs: `http://127.0.0.1:8000/docs`
   - ReDoc: `http://127.0.0.1:8000/redoc`
