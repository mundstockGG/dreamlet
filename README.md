# Dreamlet

An interactive roleplay environment platform where users can create, join, and manage themed “environments” with nested places, invite codes, and membership controls. Built with Node.js, Express, TypeScript, EJS, and Materialize CSS, using MySQL for persistence.

---

## 🚀 Features

- 🔐 **Authentication**: Register, login, logout with session management
- 🌍 **Environments**: Create SFW/NSFW environments with tags and unique invite codes
- 🔗 **Invites**: Join existing environments via invite code
- 🏷️ **Membership**: Owners, moderators, and members; owners auto‐joined on creation
- 🏠 **Places**: Create nested “places” within each environment (e.g. rooms, sub‐rooms)
- 🚪 **Leave**: Members can leave environments; owners cannot
- 🔒 **Locked**: Owners can lock/unlock environments to disable new joins (to be added)
- 🔄 **Dynamic UI**: EJS templates + Materialize modals, cards, tooltips

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, TypeScript  
- **Templating**: EJS + Partials  
- **Styling**: Materialize CSS + Custom overrides  
- **Database**: MySQL (via `mysql2/promise`)  
- **Auth**: `express-session` + `bcrypt`  
- **ORM**: Raw SQL + service layer  
- **Dev Tools**: `ts-node-dev`, TypeScript

---

## ⚙️ Prerequisites

- **Ubuntu** or any POSIX-compatible OS  
- **Node.js** v14+ & **npm**  
- **MySQL** v5.7+ (for JSON type) or fallback to `TEXT`  
- **phpMyAdmin** (optional) or MySQL CLI  

---

## 📦 Installation

1. **Clone the repo**  
   ```bash
   git clone https://github.com/your-username/roleplay-platform.git
   cd roleplay-platform
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Environment variables**  
   Copy the example file and adjust values:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   DB_HOST=localhost
   DB_USER=roleplay_user
   DB_PASSWORD=supersecurepassword
   DB_NAME=roleplay_db
   SESSION_SECRET=your_session_secret
   ```

4. **Database setup**  
   Import the schema via phpMyAdmin or CLI:
   ```bash
   mysql -u roleplay_user -p roleplay_db < schema.sql
   ```
   - If your MySQL version doesn’t support `JSON`, alter the `tags` column to `TEXT`:
     ```sql
     ALTER TABLE environments MODIFY COLUMN tags TEXT NOT NULL DEFAULT '[]';
     ```

---

## 🚧 Available Scripts

| Command           | Description                                      |
|-------------------|--------------------------------------------------|
| `npm run dev`     | Start development server with live reload        |
| `npm run build`   | Compile TypeScript into `build/` directory       |
| `npm start`       | Run the compiled app from `build/server.js`      |

---

## 📂 Project Structure

```
├── schema.sql                
├── .env.example              
├── package.json              
├── tsconfig.json             
├── public/                   
│   ├── css/
│   └── js/
└── src/
    ├── server.ts             
    ├── models/               
    ├── routes/               
    ├── controllers/          
    ├── services/             
    ├── middlewares/          
    ├── types/                
    └── views/                
```

---

## 📖 Usage

1. **Run in dev**:  
   ```bash
   npm run dev
   ```
2. **Open your browser** at `http://localhost:3000`  
3. **Register** a new user → **Login** → you’ll land on **Dashboard**  
4. **Create** or **Join** environments → **Manage** each environment → **Create Places**  

---

## 🤝 Contributing

1. Fork the repo  
2. Create a feature branch (`git checkout -b feat/xyz`)  
3. Commit your changes (`git commit -m "feat: add xyz"`)  
4. Push (`git push origin feat/xyz`) & open a Pull Request  

---

## 📜 License

[MIT](LICENSE) © Your Name
