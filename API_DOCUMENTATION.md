# Pro-Connect Backend API Documentation

## Overview
This is a service provider platform backend built with Node.js, Express, MongoDB, and JWT authentication.

---

## 📋 API Endpoints

### 1. **Register Service Provider** (Public)
**Endpoint:** `POST /api/service-providers/register`

**Description:** Register a new service provider with profile documents.

**File Requirements:**
| Field | Type | Size Limit | Format | Required |
|-------|------|-----------|--------|----------|
| cv | File | 5 MB | PDF only | Yes |
| id | File | 3 MB | JPEG/PNG | Yes |
| profile | File | 2 MB | JPEG/PNG | Yes |

**Body (form-data):**
```json
{
  "name": "Anushpa Maharjan",
  "email": "maharjananushpa@gmail.com",
  "phone": "1234562345",
  "password": "pass123@#"
}
```

**Response (Success):**
```json
{
  "message": "Service provider registered successfully!"
}
```

**Response (Error - Missing Files):**
```json
{
  "error": "CV, ID document, and profile picture are required",
  "missing": {
    "cv": true,
    "id": false,
    "profile": false
  }
}
```

**Response (Error - Invalid File):**
```json
{
  "error": "CV must be a PDF file"
}
```

**File Size Error:**
```json
{
  "error": "CV file size must be less than 5MB"
}
```

---

### 2. **Login** (Public)
**Endpoint:** `POST /api/service-providers/login`

**Description:** Authenticate user and get JWT token.

**Body (JSON):**
```json
{
  "email": "maharjananushpa@gmail.com",
  "password": "pass123@#"
}
```

**Response (Success):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Anushpa Maharjan",
    "email": "maharjananushpa@gmail.com",
    "phone": "1234562345"
  }
}
```

**Response (Error - Wrong Password):**
```json
{
  "error": "Invalid password"
}
```

**Response (Error - Email Not Registered):**
```json
{
  "error": "Email not registered"
}
```

---

### 3. **Get User Profile** (Protected)
**Endpoint:** `GET /api/service-providers/me`

**Description:** Get authenticated user's complete profile including file paths.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Anushpa Maharjan",
  "email": "maharjananushpa@gmail.com",
  "phone": "1234562345",
  "cvDocument": "D:\\pro-connect-backenddd\\uploads\\cv\\1764345719201-test.pdf",
  "idDocument": "D:\\pro-connect-backenddd\\uploads\\id\\1764345719202-id.jpg",
  "profilePic": "D:\\pro-connect-backenddd\\uploads\\profile\\1764345719203-dog.jpg",
  "district": null,
  "province": null,
  "wardNo": null
}
```

**Response (Error - No Token):**
```json
{
  "error": "No token, authorization denied"
}
```

**Response (Error - Invalid Token):**
```json
{
  "error": "Token is not valid"
}
```

---

### 4. **Download User File** (Protected)
**Endpoint:** `GET /api/service-providers/file/:userId/:fileType`

**Description:** Download user's file (cv, id, or profile) with access control.

**Parameters:**
| Param | Type | Values | Example |
|-------|------|--------|---------|
| userId | String | User's MongoDB ID | 507f1f77bcf86cd799439011 |
| fileType | String | cv, id, profile | cv |

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Example Request:**
```
GET /api/service-providers/file/507f1f77bcf86cd799439011/cv
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success):**
- File downloaded directly to client

**Response (Error - File Not Found):**
```json
{
  "error": "cv file not found"
}
```

**Response (Error - Access Denied):**
```json
{
  "error": "Access denied"
}
```

**Response (Error - Invalid File Type):**
```json
{
  "error": "Invalid file type. Use: cv, id, or profile"
}
```

---

### 5. **Ping** (Public)
**Endpoint:** `GET /api/service-providers/ping`

**Description:** Health check endpoint.

**Response:**
```
pong ✅
```

---

## 🔐 Authentication

### JWT Token
- **Generated on:** Successful login
- **Expires:** 7 days (configured in `.env`)
- **Usage:** Include in `Authorization` header as `Bearer <token>`

### Protected Endpoints
Endpoints marked as **Protected** require valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📁 File Storage

### Local Storage Structure
```
uploads/
├── cv/           # PDF documents (max 5MB each)
├── id/           # ID documents (JPEG/PNG, max 3MB)
├── profile/      # Profile pictures (JPEG/PNG, max 2MB)
└── other/        # Reserved for future use
```

### File Paths in Database
File paths are stored as strings in MongoDB:
```javascript
{
  cvDocument: "D:\\pro-connect-backenddd\\uploads\\cv\\1764345719201-test.pdf",
  idDocument: "D:\\pro-connect-backenddd\\uploads\\id\\1764345719202-id.jpg",
  profilePic: "D:\\pro-connect-backenddd\\uploads\\profile\\1764345719203-dog.jpg"
}
```

---

## ⚠️ File Validation Rules

### CV Document
- **Format:** PDF only
- **Max Size:** 5 MB
- **Required:** Yes

### ID Document
- **Format:** JPEG or PNG
- **Max Size:** 3 MB
- **Required:** Yes

### Profile Picture
- **Format:** JPEG or PNG
- **Max Size:** 2 MB
- **Required:** Yes

---

## 🔒 Security Features

✅ **Password Hashing:** bcryptjs (10 rounds)
✅ **JWT Authentication:** Token-based access control
✅ **File Access Control:** Users can only download their own files
✅ **File Type Validation:** MIME type + extension checking
✅ **File Size Limits:** Per-file and global limits
✅ **Error Handling:** Detailed error messages for debugging

---

## 🧪 Testing in Postman

### Register
1. Method: `POST`
2. URL: `http://localhost:5000/api/service-providers/register`
3. Body: `form-data`
   - name: "Your Name"
   - email: "your@email.com"
   - phone: "1234567890"
   - password: "secure_password"
   - cv: (select PDF file)
   - id: (select image file)
   - profile: (select image file)

### Login
1. Method: `POST`
2. URL: `http://localhost:5000/api/service-providers/login`
3. Body: `raw JSON`
   ```json
   {
     "email": "your@email.com",
     "password": "secure_password"
   }
   ```
4. **Copy the token from response**

### Get Profile
1. Method: `GET`
2. URL: `http://localhost:5000/api/service-providers/me`
3. Headers: 
   - Key: `Authorization`
   - Value: `Bearer <paste_token_here>`

### Download File
1. Method: `GET`
2. URL: `http://localhost:5000/api/service-providers/file/{userId}/{fileType}`
   - Replace `{userId}` with user's MongoDB ID from profile
   - Replace `{fileType}` with: cv, id, or profile
3. Headers:
   - Key: `Authorization`
   - Value: `Bearer <paste_token_here>`

---

## 📊 Database Schema

### ServiceProvider
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  phone: String (required),
  password: String (required, hashed),
  cvDocument: String (file path),
  idDocument: String (file path),
  profilePic: String (file path),
  district: String,
  province: String,
  wardNo: String
}
```

---

## 🚀 Environment Variables (.env)
```
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
```

---

## 📝 Console Logs

The API includes detailed console logging for debugging:

**Registration:**
- 📝 Register endpoint called
- 📦 req.body logged
- 📁 req.files keys logged
- 🔍 Extracted values logged
- 📁 Directory creation logged
- 📝 File write operations logged
- ✅ File save confirmations
- 💾 Database save operations
- ✅ Success/failure status

**Login:**
- 📝 Login endpoint called
- 📦 Request body logged
- 🔍 User lookup
- 🔑 Password comparison
- 🎫 Token generation
- 🔐 Token value logged

**Authentication:**
- 🔑 Auth middleware called
- 📋 Authorization header logged
- ✅ Token extracted
- 🔍 Token verification
- ✅ Decoded user info

---

## 🐛 Error Handling

All endpoints include try-catch error handling with detailed error messages:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

---

## ✨ Features Implemented

✅ User registration with file uploads
✅ Password hashing with bcryptjs
✅ JWT-based authentication
✅ File size validation
✅ File type validation
✅ File access control (users can only access their own files)
✅ Detailed console logging for debugging
✅ MongoDB Atlas integration
✅ Error handling with meaningful messages
✅ Protected endpoints with token verification

---

## 🔄 Future Enhancements

- [ ] Cloud storage integration (AWS S3)
- [ ] File deletion endpoint
- [ ] Profile update endpoint
- [ ] Delete account endpoint (with file cleanup)
- [ ] Image compression/optimization
- [ ] Rate limiting
- [ ] Email verification
- [ ] Role-based access control (Admin features)
- [ ] Refresh token mechanism
- [ ] File sharing between users

---

## 📞 Support

For issues or questions:
1. Check console logs for detailed error information
2. Verify file sizes and formats match requirements
3. Ensure JWT token is valid and not expired
4. Check MongoDB connection in `.env`

