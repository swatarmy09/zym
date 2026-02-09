# 🏋️ GymOwner Pro - Micro SaaS for Gym Owners

A simple, mobile-friendly web application for gym owners to manage their business effortlessly.

## 🚀 Features

- ✅ **Clean Login/Signup** - Mobile number-based authentication
- ✅ **Firebase Integration** - Secure authentication and database
- ✅ **Mobile-First Design** - Optimized for smartphones and tablets
- ✅ **Owner Dashboard** - Quick overview of gym statistics
- ✅ **Simple UX** - Every action takes 1-2 clicks maximum

## 📋 Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" and follow the setup wizard
3. Once created, click on "Web" icon (</>) to add a web app
4. Copy the Firebase configuration object

### 2. Configure Firebase

1. Open `firebase-config.js`
2. Replace the placeholder values with your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Enable Firebase Services

#### Enable Authentication:
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider
3. Click "Save"

#### Enable Firestore Database:
1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Start in **Test mode** (for development)
4. Choose your preferred location
5. Click "Enable"

#### Set Firestore Security Rules:
Go to **Firestore Database** → **Rules** and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gymOwners/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
    }
  }
}
```

### 4. Run the Application

Since this is a static web app, you can run it using any local server:

#### Option 1: Python (if installed)
```bash
# Python 3
python -m http.server 8000

# Then open: http://localhost:8000
```

#### Option 2: VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

#### Option 3: Node.js http-server
```bash
npx http-server -p 8000
```

### 5. Test the Application

1. Open `http://localhost:8000` in your browser
2. Click "Sign Up" tab
3. Fill in the form:
   - Gym Name: "Test Gym"
   - Owner Name: "John Doe"
   - Mobile: 9876543210
   - Password: test123
4. Click "Sign Up"
5. You should be redirected to the dashboard

## 📁 File Structure

```
gyms/
├── index.html          # Login/Signup page
├── style.css           # Authentication page styles
├── auth.js             # Authentication logic
├── dashboard.html      # Owner dashboard
├── dashboard.css       # Dashboard styles
├── dashboard.js        # Dashboard logic
├── firebase-config.js  # Firebase configuration
└── README.md          # This file
```

## 🗄️ Database Structure

### Collection: `gymOwners`

```javascript
{
  uid: "firebase-user-id",
  gymName: "Gold's Gym Downtown",
  ownerName: "Rajesh Kumar",
  mobile: "9876543210",
  email: "9876543210@gymowner.app",
  createdAt: "2026-02-09T17:16:38.000Z"
}
```

## 🎨 Design Features

- **Modern UI** - Gradient backgrounds, smooth animations
- **Mobile-Optimized** - Touch-friendly buttons (min 48px)
- **Real-time Validation** - Instant feedback on form errors
- **Loading States** - Visual feedback during API calls
- **Responsive** - Works on all screen sizes

## 🔒 Security Features

- Mobile number uniqueness validation
- Password minimum 6 characters
- Firebase Authentication
- Firestore security rules
- Auto-redirect if already logged in

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Firebase Authentication
- **Database**: Cloud Firestore
- **Hosting**: Any static hosting (Firebase Hosting, Netlify, Vercel)

## 📱 Mobile Number Format

- Must be 10 digits
- Must start with 6, 7, 8, or 9 (Indian mobile format)
- Example: 9876543210

## 🚧 Future Features

- Member management
- Payment tracking
- Attendance system
- Membership plans
- SMS notifications
- Reports and analytics

## 📞 Support

For issues or questions, please check:
- Firebase Console for authentication errors
- Browser console for JavaScript errors
- Network tab for API call failures

## 📄 License

This project is open source and available for personal and commercial use.

---

**Built with ❤️ for Gym Owners**
