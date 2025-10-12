# S3 Personal Drive

A web-based file manager for AWS S3 with Google authentication.

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd s3-personal-drive
   ```

2. **Configure your credentials**
   - Copy `config.example.js` to `config.js`
   - Fill in your AWS and Firebase credentials in `config.js`

3. **AWS Setup**
   - Create an S3 bucket
   - Create an IAM user with S3 permissions
   - Add your credentials to `config.js`

4. **Firebase Setup**
   - Create a Firebase project
   - Enable Google Authentication
   - Add your Firebase config to `config.js`

5. **Open the application**
   - Simply open `index.html` in your web browser

## Security Notes

- `config.js` contains sensitive credentials and is excluded from version control
- Never commit your actual credentials to GitHub
- The `.gitignore` file prevents `config.js` from being accidentally committed

## Features

- Google Authentication
- File upload/download
- File viewing in new tabs
- Folder creation and navigation
- File and folder deletion
- Responsive design
