# Face Spoof Detection Backend with Chrome Extension

This project includes a Django backend for detecting face spoofing and a Chrome extension frontend for image upload and detection.

---

## 🚀 Setup Instructions

1. Install Backend Dependencies

Ensure you have Python and pip installed. Then, install required Python packages:

pip install -r requirements.txt

2. Run Migrations

python manage.py migrate

3. Start the Development Server

python manage.py runserver

🧩 Load the Chrome Extension
Open Google Chrome.

Navigate to chrome://extensions/.

Enable Developer mode (top-right toggle).

Click "Load unpacked".

Select the chrome-extension folder from this project.

🧪 Test the Backend API
You can test the face spoof detection API using the following Python script:

import base64
import requests

# 🔁 Replace this with the actual image path on your machine
image_path = r"C:\Users\sanga\Downloads\archive\LCC_FASD\LCC_FASD_evaluation\spoof\spoof_944.png"

# Read and encode the image
with open(image_path, "rb") as img_file:
    encoded_img = base64.b64encode(img_file.read()).decode('utf-8')
    base64_img = f"data:image/jpeg;base64,{encoded_img}"

# 🔁 Replace with your running backend URL if different
api_url = "http://127.0.0.1:8000/api/detect/"

# Send the POST request
response = requests.post(api_url, json={"image": base64_img})

# Print the result
print("Response:", response.json())
✅ Make sure your Django server is running before executing the script.
