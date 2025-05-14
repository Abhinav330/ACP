
# Algo Crafters API Documentation

## 🔐 Authentication Endpoints
| Method | Endpoint                  | Description |
|--------|---------------------------|-------------|
| POST   | `/api/signup`             | Register a new user (with OTP verification). |
| POST   | `/api/login`              | Login and get JWT token. |
| POST   | `/api/verify-email`       | Verify email using OTP. |
| POST   | `/api/resend-otp`         | Resend OTP to email. |
| POST   | `/api/verify-otp`         | Alternative email verification using OTP. |
| POST   | `/api/forgot-password`    | Request password reset link. |
| POST   | `/api/reset-password`     | Reset password using token. |

## 📦 Questions API
| Method | Endpoint                          | Description |
|--------|-----------------------------------|-------------|
| POST   | `/api/questions`                  | Create a new question (admin only). |
| GET    | `/api/questions`                  | Fetch questions with optional filters. |
| GET    | `/api/questions/filters`          | Get all unique categories and difficulties. |
| GET    | `/api/questions/{question_id}`    | Get a specific question. |
| PUT    | `/api/questions/{question_id}`    | Update a question (admin only). |
| DELETE | `/api/questions/{question_id}`    | Delete a question (admin only). |

## 💾 Code Execution
| Method | Endpoint          | Description |
|--------|-------------------|-------------|
| POST   | `/api/execute-code` | Run submitted code against test cases using Docker. Supports scoring and submission recording. |

## 👤 User Management
| Method | Endpoint                            | Description |
|--------|-------------------------------------|-------------|
| GET    | `/api/users`                        | List all users (admin only). |
| PUT    | `/api/users/{user_id}/status`       | Update user’s admin or restricted status. |

## 🏆 User Progress & Performance
| Method | Endpoint                                          | Description |
|--------|---------------------------------------------------|-------------|
| GET    | `/api/user/progress/{candidate_id}`              | Get user’s progress and best submissions. |
| GET    | `/api/submissions/{candidate_id}/{question_id}`  | Fetch submissions for a user-question pair. |
| GET    | `/api/user/module-progress/{user_id}/{module_id}`| Get progress of a user in a specific module. |
| GET    | `/api/user-performance/{user_id}`                | Get user performance summary. |

## 🧑‍💼 Profile Management
| Method | Endpoint                        | Description |
|--------|---------------------------------|-------------|
| GET    | `/api/profiles/{user_id}`       | Get public profile. |
| GET    | `/api/private-profile`          | Get authenticated user’s private profile. |
| PUT    | `/api/private-profile`          | Update authenticated user’s profile. |
| POST   | `/api/upload-profile-picture`   | Upload profile image. |
| POST   | `/api/upload-image`             | Upload image (admin only). |

## 📚 Question Collections
| Method | Endpoint                                                       | Description |
|--------|----------------------------------------------------------------|-------------|
| GET    | `/api/question-collections`                                    | Get all collections. |
| POST   | `/api/question-collections`                                    | Create a new collection (admin only). |
| PUT    | `/api/question-collections/{collection_id}`                    | Update a collection (admin only). |
| DELETE | `/api/question-collections/{collection_id}`                    | Delete a collection (admin only). |
| POST   | `/api/question-collections/{collection_id}/questions`          | Add question to collection (admin only). |
| DELETE | `/api/question-collections/{collection_id}/questions/{question_id}` | Remove question from collection (admin only). |

## 🧮 Leaderboard
| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| GET    | `/api/leaderboard`   | Paginated list of top users based on score. |

## 📦 Modules (Admin)
| Method | Endpoint                         | Description |
|--------|----------------------------------|-------------|
| GET    | `/api/admin/modules`             | List all modules. |
| POST   | `/api/admin/modules`             | Create a new module. |
| PUT    | `/api/admin/modules/{module_id}` | Update a module. |
| DELETE | `/api/admin/modules/{module_id}` | Delete a module. |

## 🧪 Admin Question Management
| Method | Endpoint                                | Description |
|--------|-----------------------------------------|-------------|
| GET    | `/api/admin/questions`                  | Get all questions (admin only). |
| GET    | `/api/admin/questions/{question_id}`    | Get question details (admin only). |

## 🩺 Health Check
| Method | Endpoint      | Description |
|--------|---------------|-------------|
| GET    | `/api/health` | Check system health (DB, Email service, etc.). |
