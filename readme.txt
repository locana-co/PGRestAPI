based on:
http://www.bearfruit.org/2013/06/21/start-a-new-node-js-express-app-the-right-way/

to run, use node app.js
when developing, use nodemon app.js (will auto restart when any changes are made)
install globally: npm install -g nodemon

When starting as a windows service, install winser
modify the package.json:  "scripts": {
    "install-windows-service": "winser -i",
    "uninstall-windows-service": "winser -r"
  }

then run: npm run-script install-windows-service
I then had to go to task manager and start the service.

