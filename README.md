PGRestAPI
=========

## Overview

Node.js REST API for PostGres Spatial Entities.
Project is structured based on http://www.bearfruit.org/2013/06/21/start-a-new-node-js-express-app-the-right-way/

## Dependencies

PostGres 9.1 + w/ PostGIS 2.0 +
topojson

## For Windows Folks:

if you encounter errors related to "git config returned wrong result" when installing modules, explicitly set the git.exe location like so: $ npm config set "git" "C:\path\to.exe" 

On Windows with multiple versions of .NET, use:
npm install pg --msvs_version=2012


## For Hipster Ubuntu Linux Folks:
This "works on my machine" for Ubuntu Linux 12.04.  Contribute your changes as needed.

###Install Git yo …

	sudo apt-get update
	
	sudo apt-get install libcurl4-gnutls-dev libexpat1-dev gettext libz-dev libssl-dev build-essential
	
	wget http://git-core.googlecode.com/files/git-1.8.1.2.tar.gz
	
	tar -zxf git-1.8.1.2.tar.gz
	
	cd git-1.8.1.2
	
	sudo make prefix=/usr/local install
	
###Install Postgres and Postgis yo …

	sudo apt-get install python-software-properties
	
	sudo apt-add-repository ppa:ubuntugis/ppa
	
	sudo apt-get update
	
	sudo apt-get install postgresql-9.1-postgis
	
	sudo passwd postgres
	
	sudo apt-get install pgadmin3
	
	sudo apt-get install python-psycopg2
	
	sudo apt-get install libpq-dev
	
	
###Install Node yo …

	sudo apt-get update
	sudo apt-get upgrade
	sudo apt-get install g++ curl libssl-dev apache2-utils git-core
	sudo apt-get install make
	sudo apt-get install python-software-properties
	sudo add-apt-repository ppa:chris-lea/node.js
	sudo apt-get update 
	sudo apt-get install nodejs

	cd /tmp 
	git clone http://github.com/isaacs/npm.git 
	cd npm 
	sudo make install
	
###Install local instance of pancakes yo …

Congratulations!  Everything you need should be installed.  Celebrate by having some Pancakes …

![Mou icon](http://173.201.28.147/pgRESTAPI/chubbs.JPG)


###Install PgRest API yo …

* Create a target directory you will clone to e.g. .../Chubbs/pgRESTAPI
* Open terminal and cd to your target directory 
* Clone this repo
* cd to PGRestAPI
* Execute ...

    npm install

(If you're developing and want changes to automatically restart your service, install nodemon)
	npm install nodemon -g



### Create a settings.js file
Specify IP, Ports, Passwords and other settings in a file called settings.js.
An example has been provided - settings.js.example.
Settings.js must be filled out with valid settings for the application to run.

#Running as Services

###To Run as a Windows Service
When starting as a windows service, install winser
	
	npm install -g winser


modify the package.json:  

	"scripts": {
		"start" : "node app.js",
		"install-windows-service": "winser -i",
		"uninstall-windows-service": "winser -r"
	}

Install the app as a service
	
	npm run-script install-windows-service

To Uninstall the service

	npm run-script uninstall-windows-service

Open windows task manager, find 'app'(or whatever the name property is in package.json), right click and start the service.


### On Ubuntu 12 and 13
install forever module

	sudo npm install -g forever

### Run
	sudo forever start app.js

### Restarting
	sudo forever restart 0

### Stopping
	sudo forever stop 0
