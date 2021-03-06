require("dotenv").config()
const request = require("request")
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")
const mongoose = require("mongoose")
const session = require("express-session")
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const FacebookStrategy = require("passport-facebook").Strategy
const findOrCreate = require("mongoose-findorcreate")

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))

app.use(express.static(__dirname))
app.set("view engine", "ejs")

app.use(
	session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: false,
	})
)
app.use(passport.initialize())
app.use(passport.session())
//Connecting a mongoose
mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true })
// mongoose.set("useCreateIndex", true);

// Creating a Schema
const userSchema = new mongoose.Schema({
	email: String,
	password: String,
	googleId: String,
	facebookId: String,
	secret: String
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

// Creating a model
const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy())

// passport.serializeUser(User.serializeUser())
// passport.deserializeUser(User.deserializeUser())
passport.serializeUser(function (user, cb) {
	process.nextTick(function () {
		return cb(null, {
			id: user.id,
			username: user.username,
			picture: user.picture,
		})
	})
})

passport.deserializeUser(function (user, cb) {
	process.nextTick(function () {
		return cb(null, user)
	})
})

// Creating New Google Strategy
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.CLIENT_ID,
			clientSecret: process.env.CLIENT_SECRET,
			callbackURL: "http://localhost:3000/auth/google/secrets",
			userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
		},
		function (accessToken, refreshToken, profile, cb) {
			User.findOrCreate({ googleId: profile.id }, function (err, user) {
				return cb(err, user)
			})
		}
	)
)

//using a new facebook strategy
passport.use(
	new FacebookStrategy(
		{
			clientID: process.env.FACEBOOK_ID,
			clientSecret: process.env.FACEBOOK_SECRET,
			callbackURL: "http://localhost:3000/auth/facebook/secrets",
		},
		function (accessToken, refreshToken, profile, cb) {
			User.findOrCreate({ facebookId: profile.id }, function (err, user) {
				return cb(err, user)
			})
		}
	)
)

app.get("/", function (request, response) {
	response.render("home")
})
// app.get("/auth/google", function (request, response)
// {
// 	passport.authenticate("google", { scope: ["profile"] })
// })

// BETTER WAY
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }))

app.get(
	"/auth/google/secrets",
	passport.authenticate("google", { failureRedirect: "/login" }),
	function (request, response) {
		// Successful authentication, redirect home.
		response.redirect("/secrets")
	}
)

// For facebook
app.get("/auth/facebook", passport.authenticate("facebook"))

app.get(
	"/auth/facebook/secrets",
	passport.authenticate("facebook", { failureRedirect: "/login" }),
	function (request, response) {
		// Successful authentication, redirect home.
		response.redirect("/secrets")
	}
)

app.get("/register", function (request, response) {
	response.render("register")
})
app.post("/register", function (request, response) {
	User.register(
		{ username: request.body.username },
		request.body.password,
		function (err, user) {
			if (err) {
				console.log(err)
				response.redirect("/register")
			} else {
				passport.authenticate("local")(request, response, function () {
					response.redirect("/secrets")
				})
			}
		}
	)
})
app.get("/secrets", function (request, response) {
	User.find({ "secret": { $ne: null } }, function (err, foundUsers) {
		if (err) {
			console.log(err)
		} else {
			if (foundUsers) {
				if (request.isAuthenticated()) {
					response.render("secrets", { usersWithSecrets: foundUsers })
				} else {
					response.redirect("/login")
				}
				
			} else {
				console.log(err)
			}
		}
	})
})
app.get("/login", function (request, response) {
	response.render("login")
})
app.post("/login", function (request, response) {
	const user = new User({
		username: request.body.username,
		password: request.body.password,
	})
	request.login(user, function (err) {
		if (err) {
			console.log(err)
		} else {
			passport.authenticate("local")(request, response, function () {
				response.redirect("/secrets")
			})
		}
	})
})

app.get("/logout", function (request, response) {
	request.logout(function (err) {
		if (err) {
			console.log(err)
		} else {
			response.redirect("/")
		}
	})
})
app.get("/submit", function (request, response) {
	if (request.isAuthenticated()) {
		response.render("submit")
	} else {
		response.redirect("/login")
	}
})
app.post("/submit", function (request, response) {
	const submittedSecret = request.body.secret
	User.findById(request.user.id, function (err, foundUser) {
		if (err) {
			console.log(err)
		} else {
			if (foundUser) {
				foundUser.secret = submittedSecret;
				foundUser.save(function () {
					response.redirect("/secrets")
				})
			}
		}
	})
})
app.listen(3000, function () {
	console.log("Server started on port 3000")
})
