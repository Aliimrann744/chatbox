# Chatbox Database Setup Guide

This guide explains how to set up MySQL database for the Chatbox project using XAMPP.

## Prerequisites

- XAMPP installed on your computer
- Node.js (v20.0.0 or higher)
- npm (v10.0.0 or higher)

## Step 1: Install and Start XAMPP

1. Download XAMPP from [https://www.apachefriends.org/](https://www.apachefriends.org/)
2. Install XAMPP on your computer
3. Open XAMPP Control Panel
4. Start **Apache** and **MySQL** services by clicking the "Start" buttons

## Step 2: Create the Database

### Option A: Using phpMyAdmin (Recommended)

1. Open your browser and go to: `http://localhost/phpmyadmin`
2. Click on **"New"** in the left sidebar
3. Enter database name: `chatbox`
4. Select collation: `utf8mb4_general_ci` (recommended for full Unicode support)
5. Click **"Create"**

### Option B: Using MySQL Command Line

1. Open XAMPP Control Panel
2. Click **"Shell"** button
3. Type the following command:
   ```sql
   mysql -u root
   ```
4. Create the database:
   ```sql
   CREATE DATABASE chatbox CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   ```
5. Verify the database was created:
   ```sql
   SHOW DATABASES;
   ```
6. Exit MySQL:
   ```sql
   EXIT;
   ```

## Step 3: Configure Environment Variables

The `.env` file in the `server` folder is already configured with:

```env
DATABASE_URL="mysql://root:@localhost:3306/chatbox"
```

**Understanding the connection string:**
- `mysql://` - Protocol for MySQL database
- `root` - MySQL username (default XAMPP user)
- `:` - Password separator (empty password by default in XAMPP)
- `@localhost` - Database host
- `:3306` - MySQL port (default)
- `/chatbox` - Database name

### If you have a MySQL password:

Update the `.env` file:
```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/chatbox"
```

## Step 4: Run the Server

Navigate to the server folder and run:

```bash
cd server
npm install
npm run start:dev
```

The server will:
1. Install all dependencies
2. Generate Prisma client
3. Start in development mode with hot reload
4. Run on `http://localhost:5000`

## Troubleshooting

### Error: "Can't connect to MySQL server"

1. Make sure MySQL is running in XAMPP Control Panel
2. Check if port 3306 is not blocked by firewall
3. Verify the DATABASE_URL in `.env` is correct

### Error: "Access denied for user 'root'"

1. If you set a password for root user, update `.env`:
   ```env
   DATABASE_URL="mysql://root:your_password@localhost:3306/chatbox"
   ```

### Error: "Unknown database 'chatbox'"

1. Make sure you created the database in Step 2
2. Verify the database name matches in `.env`

### Error: "prisma generate" fails

Run manually:
```bash
npx prisma generate
```

## Database Management

### View Database in phpMyAdmin

1. Go to `http://localhost/phpmyadmin`
2. Click on `chatbox` in the left sidebar
3. You can view tables, run queries, and manage data

### Prisma Studio (Visual Database Editor)

Run this command to open Prisma Studio:
```bash
npx prisma studio
```
This opens a visual editor at `http://localhost:5555`

### Reset Database

To reset the database and apply fresh migrations:
```bash
npx prisma migrate reset
```

## Quick Reference

| Action | Command/URL |
|--------|-------------|
| Start XAMPP MySQL | XAMPP Control Panel > MySQL > Start |
| Open phpMyAdmin | http://localhost/phpmyadmin |
| Start Server | `npm run start:dev` |
| Open Prisma Studio | `npx prisma studio` |
| Generate Prisma Client | `npx prisma generate` |

## Environment Variables Summary

| Variable | Description | Default Value |
|----------|-------------|---------------|
| DATABASE_URL | MySQL connection string | mysql://root:@localhost:3306/chatbox |
| PORT | Server port | 5000 |
| JWT_SECRET | JWT signing secret | (configured) |
| FRONTEND_URL | Frontend application URL | http://localhost:8081 |
