PGRestAPI
=========

## Overview

Node.js REST API for PostGres Spatial Entities.

## Dependencies

PostGres w/ PostGIS
pg
PhantomJS


## For Windows Folks:

if you encounter errors related to "git config returned wrong result" when installing modules, explicitly set the git.exe location like so: $ npm config set "git" "C:\path\to.exe" 

On Windows with multiple versions of .NET, use:
npm install pg --msvs_version=2012)


## For Hipster Ubuntu Linux Folks:
This "works on my machine" for Ubuntu Linux 12.04.  Contribute your changes as needed.

###Install Apache yo …

    sudo apt-get install apache2

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
	
	sudo apt-get install build-essential
	
	sudo apt-get install curl
	
	echo 'export PATH=$HOME/local/bin:$PATH' >> ~/.bashrc
	
	. ~/.bashrc
	
	mkdir ~/local
	
	mkdir ~/node-latest-install
	
	cd ~/node-latest-install
	
	curl http://nodejs.org/dist/node-latest.tar.gz | tar xz --strip-components=1
	
	./configure --prefix=~/local
	
	make install
	
	curl https://npmjs.org/install.sh | sh
	
###Install local instance of pancakes yo …

Congratulations!  Everythin you need should be installed.  Celebrate by having some Pancakes …

![Mou icon](http://173.201.28.147/pgRESTAPI/chubbs.JPG)


###Running pgREST API yo …

* Create a target directory you will clone to e.g. .../Chubbs/pgRESTAPI
* Open terminal and cd to your target directory 
* Clone this repo
* cd to PGRestAPI
* Execute ...

    `npm install`
    
* Open PGRestAPI/app.js and change the connection string to your spatial database
* Execute ...


    `node app`

* Go to http://[server]:[port]/services

