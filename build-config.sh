    #!/bin/bash
    echo "Creating config.js from Vercel Environment Variables"
    cat > config.js << EOL
    const awsConfig = {
        bucketName: "${VITE_AWS_BUCKET_NAME}",
        region: "${VITE_AWS_REGION}",
        accessKeyId: "${VITE_AWS_ACCESS_KEY_ID}",
        secretAccessKey: "${VITE_AWS_SECRET_ACCESS_KEY}",
    };

    const firebaseConfig = {
        apiKey: "${VITE_FIREBASE_API_KEY}",
        authDomain: "${VITE_FIREBASE_AUTH_DOMAIN}",
        projectId: "${VITE_FIREBASE_PROJECT_ID}",
        storageBucket: "${VITE_FIREBASE_STORAGE_BUCKET}",
        messagingSenderId: "${VITE_FIREBASE_MESSAGING_SENDER_ID}",
        appId: "${VITE_FIREBASE_APP_ID}",
    };
    EOL

    echo "config.js created successfully."
    
