#!/bin/bash
echo "Creating config.js from Vercel Environment Variables"

# Using printf to safely handle special characters by creating valid JavaScript strings.
# This is more reliable than the previous 'cat << EOL' method.
printf "
const awsConfig = {
    bucketName: \"%s\",
    region: \"%s\",
    accessKeyId: \"%s\",
    secretAccessKey: \"%s\",
};

const firebaseConfig = {
    apiKey: \"%s\",
    authDomain: \"%s\",
    projectId: \"%s\",
    storageBucket: \"%s\",
    messagingSenderId: \"%s\",
    appId: \"%s\",
};
" \
"$VITE_AWS_BUCKET_NAME" \
"$VITE_AWS_REGION" \
"$VITE_AWS_ACCESS_KEY_ID" \
"$VITE_AWS_SECRET_ACCESS_KEY" \
"$VITE_FIREBASE_API_KEY" \
"$VITE_FIREBASE_AUTH_DOMAIN" \
"$VITE_FIREBASE_PROJECT_ID" \
"$VITE_FIREBASE_STORAGE_BUCKET" \
"$VITE_FIREBASE_MESSAGING_SENDER_ID" \
"$VITE_FIREBASE_APP_ID" \
> config.js

echo "config.js created successfully."

