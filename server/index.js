
// Place these routes after all app/model setup
// Get all pet requests (admin) - populate user info
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pet-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Use database name 'petad'
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/petad';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// === Schemas ===
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
  adoptedPets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }],
  role: { type: String, enum: ['user'], default: 'user' }, // Only 'user'
  createdAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const ownerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
  role: { type: String, default: 'owner' },
  createdAt: { type: Date, default: Date.now }
});

const petSchema = new mongoose.Schema({
  name: String,
  type: String,
  breed: String,
  age: Number,
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  description: String,
  image: String,
  // Optional location (latitude/longitude) for mapping
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  // Ownership and listing details
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'ownerModel' // Dynamic reference based on ownerModel field
  },
  ownerModel: {
    type: String,
    enum: ['User', 'Owner'],
    default: 'User'
  },
  listingType: { type: String, enum: ['adoption', 'sale'], default: 'adoption' },
  price: { type: Number },
  status: { type: String, enum: ['available', 'pending', 'adopted', 'sold'], default: 'available' },
  adoptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adoptedAt: { type: Date },
  soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  soldAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});


const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Owner = mongoose.model('Owner', ownerSchema);
const Pet = mongoose.model('Pet', petSchema);

// Store adopt/buy requests
const adoptBuyRequestSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
  type: { type: String, enum: ['adoption', 'purchase'], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  message: { type: String },
  paymentMethod: { type: String, enum: ['cod', 'card', null], default: null },
  paymentStatus: { type: String, enum: ['pending', 'succeeded', 'failed', null], default: null },
  paymentRef: { type: String, default: null },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const AdoptBuyRequest = mongoose.model('AdoptBuyRequest', adoptBuyRequestSchema);

// Chat messages between user and pet owner
const chatMessageSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
  // Always store both the user and owner ids to simplify queries
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
  fromRole: { type: String, enum: ['user', 'owner'], required: true },
  from: { type: mongoose.Schema.Types.ObjectId, required: true },
  to: { type: mongoose.Schema.Types.ObjectId, required: true },
  text: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
chatMessageSchema.index({ pet: 1, user: 1, owner: 1, createdAt: 1 });
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// === Middleware ===
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// PetRequest schema for user-submitted pet requests
const petRequestSchema = new mongoose.Schema({
  name: String,
  type: String,
  breed: String,
  age: Number,
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  description: String,
  image: String,
  // Required location (latitude/longitude) now mandatory for pet requests
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const PetRequest = mongoose.model('PetRequest', petRequestSchema);
// Add Pet Request (user)

// Add Pet Request (user) - require authentication and save user info
app.post('/api/pet-requests', authenticateToken, upload.single('image'), async (req, res) => {
  const { name, type, breed, age, gender, description, lat, lng } = req.body;
  if (!name || !type || !breed || !age || !gender || !description) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }
  // Location now mandatory
  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ success: false, message: 'Invalid latitude or longitude range' });
  }
  try {
    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const petRequest = new PetRequest({
      name,
      type,
      breed,
      age: parseInt(age),
      gender,
      description,
      image: imageUrl,
      location: { lat: latNum, lng: lngNum },
      requestedBy: req.user.userId
    });
    await petRequest.save();
    res.status(201).json({ success: true, petRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send pet request', error: err.message });
  }
});


// Get all pet requests (admin) - populate user info
app.get('/api/pet-requests', async (req, res) => {
  try {
    const requests = await PetRequest.find().populate('requestedBy', 'name email');
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch requests', error: err.message });
  }
});

// Update pet request status (admin accept/decline)
app.put('/api/pet-requests/:id', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    const petRequest = await PetRequest.findById(req.params.id);
    if (!petRequest) {
      return res.status(404).json({ success: false, message: 'Pet request not found' });
    }
    // If approved, add to pets collection
    let newPet = null;
    if (status === 'approved') {
      // Only add if not already approved
      if (petRequest.status !== 'approved') {
        newPet = new Pet({
          name: petRequest.name,
          type: petRequest.type,
          breed: petRequest.breed,
          age: petRequest.age,
          gender: petRequest.gender,
          description: petRequest.description,
          image: petRequest.image,
          status: 'available',
        });
        await newPet.save();
      }
    }
    petRequest.status = status;
    await petRequest.save();
    await petRequest.populate('requestedBy', 'name email');
    res.json({ success: true, request: petRequest, newPet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update request', error: err.message });
  }
});

// === Routes ===

// Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password || !phone || !address) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'User exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, phone, address });
    await user.save();
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name, email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Signup failed', error: err.message });
  }
});

// Owner signup
app.post('/api/owner-signup', async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password || !phone || !address) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  try {
    const existingOwner = await Owner.findOne({ email });
    if (existingOwner) return res.status(400).json({ success: false, message: 'Owner account already exists with this email' });

    // Also check if email exists in User collection to prevent conflicts
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'An account already exists with this email' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const owner = new Owner({ name, email, password: hashedPassword, phone, address });
    await owner.save();

    const token = jwt.sign({ userId: owner._id, role: 'owner' }, JWT_SECRET);
    res.status(201).json({
      success: true,
      message: 'Owner account created successfully!',
      token,
      user: { id: owner._id, name, email, role: 'owner' }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Owner signup failed', error: err.message });
  }
});

// User login
app.post('/api/user-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
});

// Admin login (use Admin collection only)
app.post('/api/admin-login', async (req, res) => {
  const { adminId, username, email, password } = req.body;
  let admin = null;
  if (!password) return res.status(400).json({ success: false, message: 'Password required' });

  // Try all possible fields for admin login in Admin collection only
  if (adminId) {
    admin = await Admin.findOne({ $or: [{ email: adminId }, { name: adminId }] });
  } else if (username) {
    admin = await Admin.findOne({ $or: [{ email: username }, { name: username }] });
  } else if (email) {
    admin = await Admin.findOne({ email });
  }

  if (!admin || !(await bcrypt.compare(password, admin.password)))
    return res.status(400).json({ success: false, message: 'Invalid credentials' });

  const token = jwt.sign({ userId: admin._id, role: admin.role }, JWT_SECRET);
  res.json({
    success: true,
    token,
    user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
  });
});

// Owner login (use Owner collection only)
app.post('/api/owner-login', async (req, res) => {
  const { ownerId, username, email, password } = req.body;
  let owner = null;
  if (!password) return res.status(400).json({ success: false, message: 'Password required' });

  if (ownerId) {
    owner = await Owner.findOne({ $or: [{ email: ownerId }, { name: ownerId }] });
  } else if (username) {
    owner = await Owner.findOne({ $or: [{ email: username }, { name: username }] });
  } else if (email) {
    owner = await Owner.findOne({ email });
  }

  if (!owner || !(await bcrypt.compare(password, owner.password)))
    return res.status(400).json({ success: false, message: 'Invalid credentials' });

  const token = jwt.sign({ userId: owner._id, role: 'owner' }, JWT_SECRET);
  res.json({
    success: true,
    token,
    user: { id: owner._id, name: owner.name, email: owner.email, role: 'owner' }
  });
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    let user;
    // Regular user path – populate adoptedPets (includes both adopted & purchased now)
    if (req.user.role === 'user') {
      user = await User.findById(req.user.userId)
        .populate({
          path: 'adoptedPets',
          select: 'name breed age description image status listingType price adoptedAt soldAt'
        });
    } else if (req.user.role === 'admin') {
      user = await Admin.findById(req.user.userId);
    } else if (req.user.role === 'owner') {
      user = await Owner.findById(req.user.userId);
    }
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile', error: err.message });
  }
});

// List pets (populate adoptedBy for admin view)
app.get('/api/pets', async (req, res) => {
  try {
    const pets = await Pet.find()
      .populate('adoptedBy', 'name email')
      .populate({
        path: 'owner',
        select: 'name email phone'
      });
    res.json(pets);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pets', error: err.message });
  }
});

// Get pets by owner ID (public endpoint)
app.get('/api/owners/:id/pets', async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id).select('name email phone');
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    const pets = await Pet.find({ 
      owner: req.params.id, 
      ownerModel: 'Owner',
      status: 'available'
    }).populate({
      path: 'owner',
      select: 'name email phone'
    });
    res.json({ success: true, owner, pets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch owner pets', error: err.message });
  }
});

// Get single pet by ID
// Get single pet by ID (public endpoint - no authentication required)
app.get('/api/pets/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id)
      .populate('adoptedBy', 'name email')
      .populate({
        path: 'owner',
        select: 'name email phone'
      });
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    res.json(pet);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pet', error: err.message });
  }
});

// Add pet (admin)
app.post('/api/pets', authenticateToken, upload.single('image'), async (req, res) => {
  // Allow both user and admin to add pets
  const { name, type, breed, age, gender, description, listingType, price, lat, lng } = req.body;
  if (!name || !type || !breed || !age || !gender || !description) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }
  try {
    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const pet = new Pet({
      name,
      type,
      breed,
      age: parseInt(age),
      gender,
      description,
      image: imageUrl,
      location: (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : undefined,
      owner: req.user?.role === 'owner' ? req.user.userId : undefined,
      ownerModel: req.user?.role === 'owner' ? 'Owner' : undefined,
      listingType: listingType || 'adoption',
      price: listingType === 'sale' ? (price ? Number(price) : undefined) : undefined
    });
    // Validate price for sale listing
    if (pet.listingType === 'sale' && (pet.price === undefined || pet.price <= 0)) {
      return res.status(400).json({ success: false, message: 'Price is required for sale listings' });
    }
    await pet.save();
    res.status(201).json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add pet', error: err.message });
  }
});

// Update pet (admin)
app.put('/api/pets/:id', authenticateToken, upload.single('image'), async (req, res) => {
  console.log('PUT /api/pets/:id - User:', req.user);
  console.log('PUT /api/pets/:id - Body:', req.body);
  console.log('PUT /api/pets/:id - File:', req.file ? req.file.filename : 'No new file');

  // Allow both user and admin to edit pets

  const { name, type, breed, age, description, status, listingType, price, lat, lng } = req.body;

  // Validate required fields
  if (!name || !type || !breed || !age || !description) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const updateData = {
      name: name.trim(),
      type,
      breed: breed.trim(),
      age: parseInt(age),
      description: description.trim(),
      status,
      listingType,
      price: listingType === 'sale' ? (price ? Number(price) : undefined) : undefined,
      location: (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : undefined
    };

    // If a new image file is uploaded, update the image URL
    if (req.file) {
      updateData.image = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    // If status is changed to available, clear the adoptedBy and adoptedAt fields
    if (status === 'available') {
      updateData.adoptedBy = null;
      updateData.adoptedAt = null;
      updateData.soldTo = null;
      updateData.soldAt = null;
    }

    console.log('Updating pet with data:', updateData);

    const pet = await Pet.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('adoptedBy', 'name email').populate('owner', 'name email');

    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    console.log('Pet updated successfully:', pet);
    res.json(pet);
  } catch (err) {
    console.error('Update pet error:', err);
    res.status(500).json({ success: false, message: 'Failed to update pet', error: err.message });
  }
});

// Delete pet (admin)
app.delete('/api/pets/:id', authenticateToken, async (req, res) => {
  // Allow both user and admin to delete pets
  try {
    await Pet.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Pet deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete pet', error: err.message });
  }
});

// Adopt pet
app.post('/api/pets/:id/adopt', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (pet.status === 'adopted') return res.status(400).json({ success: false, message: 'Pet already adopted' });
    if (pet.status === 'pending') return res.status(400).json({ success: false, message: 'Pet adoption is pending confirmation' });
    if (pet.listingType === 'sale') return res.status(400).json({ success: false, message: 'This pet is for sale; use purchase flow' });
    pet.status = 'adopted';
    pet.adoptedBy = req.user.userId;
    pet.adoptedAt = new Date();
    await pet.save();
    // Use $addToSet to avoid duplicate entries
    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { adoptedPets: pet._id } });
    res.json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to adopt pet', error: err.message });
  }
});

// Buy pet (for sale listings)
app.post('/api/pets/:id/buy', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (pet.listingType !== 'sale') return res.status(400).json({ success: false, message: 'This pet is not for sale' });
    if (pet.status === 'sold') return res.status(400).json({ success: false, message: 'Already sold' });
    if (pet.status === 'pending') return res.status(400).json({ success: false, message: 'Sale confirmation pending for this pet' });
    pet.status = 'sold';
    pet.soldTo = req.user.userId;
    pet.soldAt = new Date();
    await pet.save();
    // Treat purchases as part of acquired pets by adding to adoptedPets list for unified count
    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { adoptedPets: pet._id } });
    res.json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to buy pet', error: err.message });
  }
});

// --- New: Transactions with OTP flow ---
// Transactions track pending adopt/buy requests that require OTP confirmation by owner.
const transactionSchema = new mongoose.Schema({
  pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
  type: { type: String, enum: ['adoption', 'purchase'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner' },
  otp: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  rating: { type: Number, min: 1, max: 5 },
  userRated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// Initiate a transaction (user initiates adopt/buy -> creates pending transaction with OTP)
app.post('/api/pets/:id/initiate', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id).populate('owner');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    const { type } = req.body || {};
    if (!['adoption', 'purchase'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid type' });
    if (type === 'adoption' && pet.listingType === 'sale') return res.status(400).json({ success: false, message: 'This pet is listed for sale' });
    if (type === 'purchase' && pet.listingType !== 'sale') return res.status(400).json({ success: false, message: 'This pet is not for sale' });
    if (pet.status === 'adopted' || pet.status === 'sold') return res.status(400).json({ success: false, message: 'Pet not available' });
    if (pet.status === 'pending') return res.status(400).json({ success: false, message: 'Another request for this pet is pending confirmation' });

    // Generate a simple 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const tx = new Transaction({
      pet: pet._id,
      type,
      user: req.user.userId,
      owner: pet.owner && pet.owner._id ? pet.owner._id : undefined,
      otp
    });
    await tx.save();

    // Mark the pet as pending so it no longer appears in available listings
    pet.status = 'pending';
    await pet.save();

    // In a real app we'd send the OTP via SMS/email to the owner. For now, log it so developers can test.
    console.log('Transaction OTP for tx', tx._id.toString(), 'otp=', otp);

    res.status(201).json({ success: true, transactionId: tx._id, message: 'Transaction initiated. Owner must confirm with OTP after user rates them.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to initiate transaction', error: err.message });
  }
});

// User: list their transactions
app.get('/api/user/transactions', authenticateToken, async (req, res) => {
  try {
    const txs = await Transaction.find({ user: req.user.userId }).populate('pet', 'name image owner').sort({ createdAt: -1 });
    res.json({ success: true, transactions: txs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: err.message });
  }
});

// Owner: list transactions for their pets
app.get('/api/owner/transactions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const txs = await Transaction.find({ owner: req.user.userId }).populate('pet', 'name image').populate('user', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, transactions: txs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch owner transactions', error: err.message });
  }
});

// User marks that they have rated the owner (owner can only confirm after userRated === true)
app.post('/api/transactions/:id/rate', authenticateToken, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (String(tx.user) !== String(req.user.userId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const ratingValue = Number(req.body?.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
    }
    tx.rating = Math.round(ratingValue * 10) / 10;
    tx.userRated = true;
    tx.markModified('rating');
    await tx.save();
    res.json({ success: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update transaction', error: err.message });
  }
});

// Owner confirms transaction by providing OTP (only allowed after userRated)
app.post('/api/transactions/:id/confirm', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });
    const tx = await Transaction.findById(req.params.id).populate('pet');
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (String(tx.owner) !== String(req.user.userId)) return res.status(403).json({ success: false, message: 'Not your transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ success: false, message: 'Transaction not pending' });
    if (tx.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });

    // Mark transaction confirmed and update pet status accordingly
    tx.status = 'confirmed';
    await tx.save();

    const pet = await Pet.findById(tx.pet._id);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (tx.type === 'adoption') {
      pet.status = 'adopted';
      pet.adoptedBy = tx.user;
      pet.adoptedAt = new Date();
      await User.findByIdAndUpdate(tx.user, { $addToSet: { adoptedPets: pet._id } });
    } else if (tx.type === 'purchase') {
      pet.status = 'sold';
      pet.soldTo = tx.user;
      pet.soldAt = new Date();
      await User.findByIdAndUpdate(tx.user, { $addToSet: { adoptedPets: pet._id } });
    }
    await pet.save();

    res.json({ success: true, message: 'Transaction confirmed and pet status updated', transaction: tx, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to confirm transaction', error: err.message });
  }
});

// Public: top-rated owners for about page highlights
app.get('/api/owners/top-rated', async (req, res) => {
  try {
    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 10) : 5;

    const owners = await Transaction.aggregate([
      { $match: { owner: { $ne: null }, rating: { $gte: 1 } } },
      {
        $group: {
          _id: '$owner',
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          lastRatedAt: { $max: '$createdAt' }
        }
      },
      { $lookup: { from: 'owners', localField: '_id', foreignField: '_id', as: 'owner' } },
      { $unwind: '$owner' },
      {
        $project: {
          _id: 0,
          ownerId: '$_id',
          name: '$owner.name',
          email: '$owner.email',
          phone: '$owner.phone',
          averageRating: { $round: ['$averageRating', 1] },
          totalRatings: 1,
          lastRatedAt: 1
        }
      },
      { $sort: { averageRating: -1, totalRatings: -1, name: 1 } },
      { $limit: limit }
    ]);

    res.json({ success: true, owners });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load top-rated owners', error: err.message });
  }
});

// Create adopt/buy request for a pet (does not change pet status immediately)
app.post('/api/pets/:id/request', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });

    const { type, name, email, phone, address, message, paymentMethod, paymentStatus, paymentRef } = req.body || {};
    if (!['adoption', 'purchase'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid request type' });
    }
    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Name, email and phone are required' });
    }
    if (type === 'purchase' && pet.listingType !== 'sale') {
      return res.status(400).json({ success: false, message: 'This pet is not for sale' });
    }
    if (type === 'adoption' && pet.listingType === 'sale') {
      return res.status(400).json({ success: false, message: 'This pet is listed for sale' });
    }

    const reqDoc = await AdoptBuyRequest.create({
      pet: pet._id,
      type,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: (address || '').trim(),
      message: (message || '').trim(),
      paymentMethod: paymentMethod || null,
      paymentStatus: paymentStatus || null,
      paymentRef: paymentRef || null,
      requestedBy: req.user?.userId
    });

    res.status(201).json({ success: true, request: reqDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create request', error: err.message });
  }
});

// === Chat routes ===
// Get messages for a pet between the current user and the owner
// - For regular users: no userId param needed; uses token userId
// - For owners: must provide userId query param to specify which user's thread
app.get('/api/pets/:id/messages', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id).populate('owner', '_id');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (!pet.owner || pet.ownerModel !== 'Owner') {
      return res.status(400).json({ success: false, message: 'Messaging is only available for pets owned by a registered Owner account' });
    }

    let userId, ownerId;
    if (req.user.role === 'owner') {
      // Owner can only read if they own the pet
      if (String(pet.owner?._id || pet.owner) !== String(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      userId = req.query.userId;
      if (!userId) return res.status(400).json({ success: false, message: 'userId is required for owner view' });
      ownerId = req.user.userId;
    } else if (req.user.role === 'user') {
      userId = req.user.userId;
      ownerId = String(pet.owner?._id || pet.owner);
    } else if (req.user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin is not allowed for chat' });
    }

    const messages = await ChatMessage.find({
      pet: pet._id,
      user: userId,
      owner: ownerId
    }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: err.message });
  }
});

// Send a message for a pet
// Body: { text, userId? }
// - User: sends to owner; no userId needed
// - Owner: must include userId to reply to a specific user thread
app.post('/api/pets/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { text, userId: bodyUserId } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message text is required' });
    if (text.trim().length > 500) return res.status(400).json({ success: false, message: 'Message exceeds 500 character limit' });

    const pet = await Pet.findById(req.params.id).populate('owner', '_id');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (!pet.owner || pet.ownerModel !== 'Owner') {
      return res.status(400).json({ success: false, message: 'Messaging is only available for pets owned by a registered Owner account' });
    }

    let doc = null;
    if (req.user.role === 'user') {
      doc = await ChatMessage.create({
        pet: pet._id,
        user: req.user.userId,
        owner: (pet.owner?._id || pet.owner),
        fromRole: 'user',
        from: req.user.userId,
        to: (pet.owner?._id || pet.owner),
        text: text.trim()
      });
    } else if (req.user.role === 'owner') {
      // Owner must own the pet
      if (String(pet.owner?._id || pet.owner) !== String(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const replyUserId = bodyUserId || req.query.userId;
      if (!replyUserId) return res.status(400).json({ success: false, message: 'userId is required for owner to send message' });
      doc = await ChatMessage.create({
        pet: pet._id,
        user: replyUserId,
        owner: req.user.userId,
        fromRole: 'owner',
        from: req.user.userId,
        to: replyUserId,
        text: text.trim()
      });
    } else {
      return res.status(403).json({ success: false, message: 'Admin is not allowed for chat' });
    }

    res.status(201).json({ success: true, message: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send message', error: err.message });
  }
});

// Owner: list conversations grouped by pet and user with last message
app.get('/api/owner/conversations', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const pipeline = [
      { $match: { owner: new mongoose.Types.ObjectId(req.user.userId) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { pet: '$pet', user: '$user' },
          lastMessage: { $first: '$text' },
          lastAt: { $first: '$createdAt' },
          unread: { $sum: { $cond: [{ $and: [{ $eq: ['$fromRole', 'user'] }, { $eq: ['$read', false] }] }, 1, 0] } }
        }
      },
      { $lookup: { from: 'pets', localField: '_id.pet', foreignField: '_id', as: 'pet' } },
      { $unwind: '$pet' },
      { $lookup: { from: 'users', localField: '_id.user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          pet: { _id: '$pet._id', name: '$pet.name', image: '$pet.image' },
          user: { _id: '$user._id', name: '$user.name', email: '$user.email' },
          lastMessage: 1,
          lastAt: 1,
          unread: 1
        }
      },
      { $sort: { lastAt: -1 } }
    ];
    const conversations = await ChatMessage.aggregate(pipeline);
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: err.message });
  }
});

// Mark messages as read for a pet thread (user or owner context)
app.post('/api/pets/:id/messages/mark-read', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id).populate('owner', '_id');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (!pet.owner || pet.ownerModel !== 'Owner') {
      return res.status(400).json({ success: false, message: 'Messaging is only available for pets owned by a registered Owner account' });
    }
    let filter = { pet: pet._id };
    if (req.user.role === 'user') {
      filter.user = req.user.userId;
      filter.owner = pet.owner._id || pet.owner;
      filter.fromRole = 'owner';
      filter.read = false;
    } else if (req.user.role === 'owner') {
      if (String(pet.owner?._id || pet.owner) !== String(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
      filter.user = userId;
      filter.owner = req.user.userId;
      filter.fromRole = 'user';
      filter.read = false;
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const result = await ChatMessage.updateMany(filter, { $set: { read: true } });
    res.json({ success: true, updated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark messages read', error: err.message });
  }
});

// Delete/clear a chat thread (close chat) for a specific pet.
// User: deletes their thread with the pet owner.
// Owner: must provide userId in body to delete that user's thread.
app.delete('/api/pets/:id/messages', authenticateToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id).populate('owner', '_id');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (!pet.owner || pet.ownerModel !== 'Owner') {
      return res.status(400).json({ success: false, message: 'Messaging not enabled for this pet' });
    }
    let filter = { pet: pet._id };
    if (req.user.role === 'user') {
      filter.user = req.user.userId;
      filter.owner = pet.owner._id || pet.owner;
    } else if (req.user.role === 'owner') {
      if (String(pet.owner?._id || pet.owner) !== String(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
      filter.user = userId;
      filter.owner = req.user.userId;
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const result = await ChatMessage.deleteMany(filter);
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to clear chat', error: err.message });
  }
});

// === Owner-specific routes (secure to the owning user) ===

// List pets for the logged-in owner
app.get('/api/owner/pets', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const pets = await Pet.find({ owner: req.user.userId })
      .populate('owner', 'name email')
      .populate('adoptedBy', 'name email phone');
    res.json({ success: true, pets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch owner pets', error: err.message });
  }
});

// Get a single pet owned by the user
app.get('/api/owner/pets/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const pet = await Pet.findOne({ _id: req.params.id, owner: req.user.userId })
      .populate('owner', 'name email')
      .populate('adoptedBy', 'name email phone');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    res.json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pet', error: err.message });
  }
});

// Owner add pet (sale or adoption)
app.post('/api/owner/pets', authenticateToken, upload.single('image'), async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  const { name, type, breed, age, gender, description, listingType, price, lat, lng } = req.body;
  if (!name || !type || !breed || !age || !gender || !description) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }
  try {
    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const pet = new Pet({
      name, type, breed, age: parseInt(age), gender, description, image: imageUrl,
      location: (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : undefined,
      owner: req.user.userId,
      ownerModel: 'Owner',
      listingType: listingType || 'adoption',
      price: listingType === 'sale' ? (price ? Number(price) : undefined) : undefined
    });
    if (pet.listingType === 'sale' && (pet.price === undefined || pet.price <= 0)) {
      return res.status(400).json({ success: false, message: 'Price is required for sale listings' });
    }
    await pet.save();
    res.status(201).json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add pet', error: err.message });
  }
});

// Owner update pet
app.put('/api/owner/pets/:id', authenticateToken, upload.single('image'), async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const pet = await Pet.findOne({ _id: req.params.id, owner: req.user.userId });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });

    const { name, type, breed, age, gender, description, status, listingType, price, lat, lng } = req.body;
    if (!name || !type || !breed || !age || !gender || !description) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    pet.name = name.trim();
    pet.type = type;
    pet.breed = breed.trim();
    pet.age = parseInt(age);
    pet.gender = gender;
    pet.description = description.trim();
    pet.status = status || pet.status;
    pet.listingType = listingType || pet.listingType;
    pet.price = pet.listingType === 'sale' ? (price ? Number(price) : pet.price) : undefined;
    if (lat && lng) {
      pet.location = { lat: Number(lat), lng: Number(lng) };
    }

    if (req.file) {
      pet.image = `http://localhost:5000/uploads/${req.file.filename}`;
    }
    if (pet.status === 'available') {
      pet.adoptedBy = null;
      pet.adoptedAt = null;
      pet.soldTo = null;
      pet.soldAt = null;
    }

    await pet.save();
    await pet.populate('owner', 'name email');
    res.json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update pet', error: err.message });
  }
});

// Owner delete pet
app.delete('/api/owner/pets/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.user.userId });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    res.json({ success: true, message: 'Pet deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete pet', error: err.message });
  }
});

// Owner mark pet as sold
app.post('/api/owner/pets/:id/mark-sold', authenticateToken, async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const pet = await Pet.findOne({ _id: req.params.id, owner: req.user.userId });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });
    if (pet.listingType !== 'sale') return res.status(400).json({ success: false, message: 'Only sale listings can be marked as sold' });
    if (pet.status === 'sold') return res.status(400).json({ success: false, message: 'Already marked as sold' });
    pet.status = 'sold';
    pet.soldAt = new Date();
    await pet.save();
    res.json({ success: true, pet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark pet as sold', error: err.message });
  }
});

// Get all users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
  }
});

// Initialize admin (in Admin collection)
const initializeAdmin = async () => {
  const admin = await Admin.findOne({ role: 'admin' });
  if (!admin) {
    const password = await bcrypt.hash('admin123', 10);
    await new Admin({
      name: 'admin',
      email: 'admin@tailmate.com',
      password,
      phone: '0000000000',
      address: 'Admin HQ',
      role: 'admin'
    }).save();
    console.log('Default admin created');
  }
};

initializeAdmin();
// Initialize default owner (optional)
const initializeOwner = async () => {
  const existing = await Owner.findOne({ role: 'owner' });
  if (!existing) {
    const password = await bcrypt.hash('owner123', 10);
    await new Owner({
      name: 'owner',
      email: 'owner@tailmate.com',
      password,
      phone: '1111111111',
      address: 'Owner Home',
      role: 'owner'
    }).save();
    console.log('Default owner created');
  }
};
initializeOwner();

// Admin owner management endpoints
app.get('/api/admin/owners', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const owners = await Owner.find({}).select('-password').sort({ createdAt: -1 });

    // Count pets for each owner
    const ownersWithPetCount = await Promise.all(
      owners.map(async (owner) => {
        const petCount = await Pet.countDocuments({ owner: owner._id, ownerModel: 'Owner' });
        return {
          ...owner.toObject(),
          pets: Array(petCount).fill(null) // Just for count, not actual pets
        };
      })
    );

    res.json({ success: true, owners: ownersWithPetCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch owners', error: err.message });
  }
});

app.get('/api/admin/owners/:id', authenticateToken, async (req, res) => {
  console.log('Admin owner details request - User:', req.user, 'Owner ID:', req.params.id);
  if (req.user.role !== 'admin') {
    console.log('Access denied for owner details - Role:', req.user.role);
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  try {
    const owner = await Owner.findById(req.params.id).select('-password');
    console.log('Owner found:', owner ? 'Yes' : 'No');
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });
    const ratingStats = await Transaction.aggregate([
      { $match: { owner: owner._id, rating: { $gte: 1 } } },
      {
        $group: {
          _id: '$owner',
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          lastRatedAt: { $max: '$createdAt' }
        }
      }
    ]);

    const ratingSummary = ratingStats[0] || null;
    const ownerPayload = owner.toObject();
    ownerPayload.ratingAverage = ratingSummary ? Math.round(ratingSummary.averageRating * 10) / 10 : null;
    ownerPayload.ratingCount = ratingSummary ? ratingSummary.totalRatings : 0;
    ownerPayload.lastRatedAt = ratingSummary?.lastRatedAt || null;

    res.json({ success: true, owner: ownerPayload });
  } catch (err) {
    console.log('Error fetching owner:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch owner', error: err.message });
  }
});

app.get('/api/admin/owner/:id/pets', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  try {
    const pets = await Pet.find({ owner: req.params.id, ownerModel: 'Owner' }).sort({ createdAt: -1 });
    res.json({ success: true, pets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch owner pets', error: err.message });
  }
});

app.delete('/api/admin/owners/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    // Also delete all pets owned by this owner
    await Pet.deleteMany({ owner: req.params.id, ownerModel: 'Owner' });

    await Owner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Owner and associated pets deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete owner', error: err.message });
  }
});

// ========== PUBLIC STATS API ==========
app.get('/api/stats', async (req, res) => {
  try {
    const [
      totalPets,
      adoptedPets,
      soldPets,
      availablePets,
      totalUsers,
      totalOwners,
      pendingRequests
    ] = await Promise.all([
      Pet.countDocuments(),
      Pet.countDocuments({ status: 'adopted' }),
      Pet.countDocuments({ status: 'sold' }),
      Pet.countDocuments({ status: 'available' }),
      User.countDocuments(),
      Owner.countDocuments(),
      AdoptBuyRequest.countDocuments()
    ]);

    res.json({
      success: true,
      stats: {
        totalPets,
        adoptedPets,
        soldPets,
        availablePets,
        totalUsers,
        totalOwners,
        pendingRequests,
        successRate: totalPets > 0 ? Math.round(((adoptedPets + soldPets) / totalPets) * 100) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
