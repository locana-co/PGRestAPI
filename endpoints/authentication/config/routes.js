var User = require('../app/models/user');
var Auth = require('../config/middlewares/authorization.js');

module.exports = function(app, passport){
	
	app.set('views', './endpoints/authentication/app/views');
	app.set('view engine', 'jade');


        app.get("/", function(req, res){ 
                if(req.isAuthenticated()){
                  res.render("home", { user : req.user}); 
                }else{
                        res.render("home", { user : null});
                }
        });

        app.get("/login", function(req, res){ 
                res.render("login");
        });

        app.post("/login" 
                ,passport.authenticate('local',{
                        successRedirect : "/",
                        failureRedirect : "/login",
                })
        );

        app.get("/signup", function (req, res) {
                res.render("signup");
        });

        app.post("/signup", Auth.userExist, function (req, res, next) {
                User.signup(req.body.email, req.body.password, function(err, user){
                        if(err) throw err;
                        req.login(user, function(err){
                                if(err) return next(err);
                                return res.redirect("profile");
                        });
                });
        });

        app.get("/auth/facebook", passport.authenticate("facebook",{ scope : "email"}));
        app.get("/auth/facebook/callback", 
                passport.authenticate("facebook",{ failureRedirect: '/login'}),
                function(req,res){
                        res.render("profile", {user : req.user});
                }
        );

        app.get('/auth/google',
          passport.authenticate(
                  'google',
                  {
                          scope: [
                          'https://www.googleapis.com/auth/userinfo.profile',
                          'https://www.googleapis.com/auth/userinfo.email'
                          ]
                  })
          );

        app.get('/auth/google/callback', 
          passport.authenticate('google', { failureRedirect: '/login' }),
          function(req, res) {
            // Successful authentication, redirect home.
            res.redirect('/');
          });

        app.get("/profile", Auth.isAuthenticated , function(req, res){ 
                res.render("profile", { user : req.user});
        });

        app.get('/logout', function(req, res){
                req.logout();
                res.redirect('/login');
        });
}