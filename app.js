const express = require('express');
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require('cookie-parser');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const post = require('./models/post');

// app.get("/", (req, res)=>{
//     res.send("hey");
// })

// app.get("/create", async (req, res)=>{
//     let user = await userModel.create({
//         username: "harsh",
//         email:"harsh@gmail.com",
//         age: 25
//     });

//     res.send(user);
// })

// app.get("/post/create", async (req, res)=>{
//     let post = await postModel.create({
//         postdata: "hello saare log kaise ho",
//         user: "67a349ab52b751d85c1b6270"

//     });

//     let user = await userModel.findOne({_id: "67a349ab52b751d85c1b6270"});
//     user.posts.push(post._id);
//     await user.save();

//     res.send({post, user});
// })

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.get('/', (req,res)=>{
    res.render("index");
})

app.get('/login', (req,res)=>{
    res.render("login");
})

app.get("/profile", isLoggedIn, async (req, res) => {
    try {
        let user = await userModel.findOne({ email: req.user.email }).populate("posts");

        if (!user) {
            return res.status(404).send("User not found");
        }

        // Ensure posts and likes array exist
        user.posts.forEach(post => {
            if (!post.likes) post.likes = [];
        });

        res.render("profile", { user });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/like/:id", isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        let user = await userModel.findOne({ email: req.user.email });

        if (!user) {
            return res.status(404).send("User not found");
        }

        // Ensure likes array exists and filter out any null values
        if (!post.likes) post.likes = [];
        post.likes = post.likes.filter(like => like); // Remove null values

        let userIndex = post.likes.findIndex(like => like.toString() === user._id.toString());

        if (userIndex === -1) {
            // Add like
            post.likes.push(user._id);
        } else {
            // Unlike (remove the user ID from likes array)
            post.likes.splice(userIndex, 1);
        }

        await post.save();
        res.redirect("/profile");
    } catch (error) {
        console.error("Error liking/unliking post:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);
    res.render("edit", {post});
         
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content});
    res.redirect("/profile");
         
});



app.post('/register', async (req,res)=>{
    let {email, password, username, name, age} = req.body;

    let user = await userModel.findOne({email});
    if(user) return res.status(500).send("User already registered");

    bcrypt.genSalt(10, (err, salt)=>{
        bcrypt.hash(password, salt, async (err, hash)=>{
            let user = await userModel.create({
                username,
                email,
                age,
                name,
                password: hash
            });

            let token = jwt.sign({email: email, useride: user._id}, "shhhh");
            res.cookie("token", token);
            res.send("registered");

        })
    })
})

app.post('/login', async (req,res)=>{
    let {email, password} = req.body;

    let user = await userModel.findOne({email});
    if(!user) return res.status(500).send("Something went wrong");

    bcrypt.compare(password, user.password, (err, result)=>{
        if(result) {
            let token = jwt.sign({email: email, useride: user._id}, "shhhh");
            res.cookie("token", token);
            res.status(200).redirect("/profile");
        }
        else res.redirect("/login");
    })
})

app.get('/logout', (req,res)=>{
    res.cookie("token", "");
    res.redirect("/login");
})

//middleware
function isLoggedIn(req, res, next){
    if(req.cookies.token === "") res.redirect("/login");
    else{
        let data = jwt.verify(req.cookies.token, "shhhh");
        req.user = data;
        next();
    }
    
}

app.post('/post', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email });
    let { content } = req.body;

    try {
        // Create the post and assign it to a variable
        let post = await postModel.create({ 
            user: user._id, 
            content 
        });

        // Ensure the user's posts array is valid
        if (!user.posts) user.posts = [];
        
        user.posts = user.posts.filter(postId => postId); // Remove null/undefined values
        user.posts.push(post._id); // Push the new post ID
        
        await user.save(); // Save the updated user

        res.redirect("/profile");
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).send("Error creating post");
    }
});

app.listen(3000);