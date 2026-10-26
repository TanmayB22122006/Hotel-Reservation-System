const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["guest", "admin"],
      default: "guest"
    },
    profilePhotoKey: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
