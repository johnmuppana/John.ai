const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let marked;
(async () => {
  marked = (await import('marked')).marked;
})();

const app = express();

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect("/login");
  }
}

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'mySecretKey',
  resave: false,
  saveUninitialized: true
}));

mongoose.connect('mongodb://127.0.0.1:27017/chatgpt-clone', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

const Chat = require('./models/temp');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/chat');
  res.redirect('/login');
});

app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.render('signup', { error: 'Username or Email already exists.' });
    }

    const newUser = new User({ username, email, password: hashed });
    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    console.error('Signup Error:', err);
    res.render('signup', { error: 'Signup failed. Please try again.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = user;
      res.redirect('/chat');
    } else {
      res.render('login', { error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Login Error:', err);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
});

app.get('/chat', isAuthenticated, async (req, res) => {
  if (!marked) marked = (await import('marked')).marked;

  const chats = await Chat.find({ userId: req.session.user._id }).select('title');
  res.render('chat', {
    username: req.session.user.username,
    chats,
    selectedChat: null,
    marked
  });
});

app.get('/chat/:id', isAuthenticated, async (req, res) => {
  if (!marked) marked = (await import('marked')).marked;

  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat || chat.userId.toString() !== req.session.user._id.toString()) {
      return res.status(404).send("Chat not found");
    }

    const chats = await Chat.find({ userId: req.session.user._id }).select('title');
    res.render('chat', {
      username: req.session.user.username,
      chats,
      selectedChat: chat,
      marked
    });
  } catch (err) {
    console.error('Error loading chat:', err);
    res.status(500).send("Error loading chat");
  }
});

app.post('/chat', isAuthenticated, async (req, res) => {
  const { message, chatId, modelName } = req.body;
  const userId = req.session.user._id;

  const genAI = new GoogleGenerativeAI("Your-API-Key-Here");

  const selectedModel = modelName || "models/gemini-1.5-flash";
  const model = genAI.getGenerativeModel({ model: selectedModel });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }]
    });

    let reply = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    reply = reply.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `\`\`\`\n${code.trim()}\n\`\`\``;
    });

    let chat;
    if (chatId) {
      chat = await Chat.findById(chatId);
      if (!chat) return res.status(404).send("Chat not found");

      chat.messages.push(
        { role: 'user', content: message },
        { role: 'assistant', content: reply }
      );
    } else {
      chat = new Chat({
        userId,
        title: message.slice(0, 30),
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: reply }
        ]
      });
    }

    await chat.save();

    res.send(JSON.stringify({
      reply,
      chatId: chat._id.toString()
    }));

  } catch (err) {
    console.error('❌ Gemini error:', err);

    if (err.status === 503) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('overloaded')) {
        return res.status(503).send("❌ Gemini model is overloaded or temporarily unavailable. Please try again later.");
      }
      return res.status(503).send("❌ You may have hit your usage limit. Try again in 24 hours.");
    }

    res.status(500).send("❌ Error fetching Gemini response.");
  }
});

app.post('/chat/delete/:id', isAuthenticated, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (chat && chat.userId.toString() === req.session.user._id.toString()) {
      await chat.deleteOne();
    }
    res.redirect('/chat');
  } catch (err) {
    console.error('❌ Delete Error:', err);
    res.status(500).send("❌ Failed to delete chat.");
  }
});


app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});
