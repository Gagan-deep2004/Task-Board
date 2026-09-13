const mongoose = require('mongoose');


//owner: A reference (ObjectId) pointing to the User model, representing the creator or owner of the board
//members: An array of subdocuments used for access control
const BoardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tier: { type: String, enum: ['Private', 'Shared', 'Public'], default: 'Private' },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['Admin', 'Viewer'], default: 'Viewer' }
  }]
}, { timestamps: true, optimisticConcurrency: true });
//optimisticConcurrency: true: Enables Mongoose's built-in versioning (__v field) to prevent race conditions

module.exports = mongoose.model('Board', BoardSchema);

//type: mongoose.Schema.Types.ObjectId: Specifies that the field stores a standard MongoDB ObjectId (a unique 24-character hexadecimal identifier), which is the default primary key type generated for MongoDB documents.
//ref: 'User': Tells Mongoose which model this ID points to. This allows you to use Mongoose's
//This allows you to use Mongoose's .populate() method later to automatically fetch and replace the stored ID with the actual user document data when querying the database.