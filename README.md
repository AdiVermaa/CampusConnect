1. Project Title
   CampusConnect – A Professional Networking Platform for Rishihood University
3. Problem Statement
      Students at Rishihood University often struggle to build professional connections within their own campus. Opportunities like internships, projects, collaborations, and event
       updates are scattered across multiple WhatsApp groups and emails — making networking inefficient and messy. CampusConnect aims to create a centralized platform where students, faculty,and
    alumni can:
      ● Showcase their profiles and achievements
      ● Post updates and opportunities
      ● Build professional connections within the campus ecosystem
4. System Architecture
    ● Architecture Overview:
        Frontend             ==>           Backend (API)           ==> Database
        React.js (Frontend) ==> Express.js + Node.js (Backend API) ==> MongoDB Atlas (Database) ==> JWT Authentication ==> Hosted on Vercel + Render
    ● Stack Summary:
        Layer    |  Technology
        Frontend |  React.js, React Router, Axios,TailwindCSS
        Backend  |  Node.js, Express.js
        Database |  MongoDB (via MongoDB Atlas)
        Authentication  |  JWT-based authentication
        Hosting  |  Frontend → Vercel / Netlify
                 |  Backend → Render / Railway
                 |  Database → MongoDB Atlas
5. System Design Diagram
    [ React Frontend ]
      ↓ (Axios API calls)
    [ Express Backend + JWT Auth ]
      ↓
    [ MongoDB Atlas Database ]
6. Key Features
    Category Features
    Authentication & Authorization Signup/Login using JWT, password encryption (bcrypt), and role-based access (student/faculty/admin)
    User Profiles Profile page with bio, course, skills, photo, and external links (LinkedIn, GitHub, etc.)
    Posts & Feeds Create, like, and comment on posts – similar to LinkedIn feed
    Connections Follow/unfollow users to build your campus network
    Search Search users by name, department, or skill
    Messaging (Optional) Private chat between connected users
    Events & Opportunities Post and browse events, internships, and campus updates
    Admin Dashboard Admin can manage users, posts, and reported content
    Hosting Frontend and backend both deployed with live URLs
7. Tech Stack
    Layer          |        Technologies
    Frontend       |        React.js, React Router, Axios, TailwindCSS
    Backend        |        Node.js, Express.js
    Database       |        MongoDB (Mongoose ORM)
    Authentication |        JWT, bcrypt
    Hosting        |        Vercel (frontend), Render (backend), MongoDB Atlas(database)
8. API Overview
    Endpoint                     |   Method     |      Description            |    Access
    /api/auth/signup             |    POST      |    Register new user        |     Public
    /api/auth/login              |    POST      |    Authenticate user        |     Public
    /api/users/:id               |    GET       |    Get user profile         |  Authenticated
    /api/users/update            |    PUT       |    Update user profile      |  Authenticated
    /api/posts                   |    GET       |    Fetch all posts for feed |   Authenticated
    /api/posts                   |    POST      |    Create new post          |   Authenticated
    /api/posts/:id               |    PUT       |    Edit post                |   Author only
    /api/posts/:id               |    DELETE    |    Delete post              |   Author/Admin
    /api/connections/:id         |    POST      |    Send connectionrequest   |   Authenticated
    /api/connections/:id/accept  |    PUT       |    Accept connection        |   Authenticated
    /api/search                  |    GET       |    Search users or posts    |   Authenticated
9. Future Enhancements
  ● Add AI-based job/internship recommendations
  ● Real-time chat using Socket.i
  ● Integration with college email (for automatic signup verification)
  ● Mobile app version using React Native
