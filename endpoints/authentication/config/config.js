module.exports = {
        development: {
                db: 'mongodb://localhost/chubbs_authentication',
                app: {
                        name: 'Chubbs Spatial Server'
                },
                facebook: {
                        clientID: "{{PLACEHOLDER}}",
                        clientSecret: "{{PLACEHOLDER}}",
                        callbackURL: "{{PLACEHOLDER}}"
                },

                google: {
                        clientID: "{{PLACEHOLDER}}",
                        clientSecret: "{{PLACEHOLDER}}",
                        callbackURL: "{{PLACEHOLDER}}"
                }
        },
          production: {
            db: process.env.MONGOLAB_URI || process.env.MONGOHQ_URL,
                app: {
                        name: 'Passport Authentication Tutorial'
                },
                facebook: {
                        clientID: "",
                        clientSecret: "",
                        callbackURL: ""
                },
                google: {
                        clientID: '',
                        clientSecret: '',
                        callbackURL: ''
                }
         }
}