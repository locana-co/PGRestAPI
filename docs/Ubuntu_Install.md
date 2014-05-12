PGRestAPI - Ubuntu Installation
=========

## Dependencies

* [Mapnik](https://github.com/mapnik/mapnik)

(Assumes you've got a PostGreSQL 9.1+ and PostGIS 2.0+ is installed somewhere)

###Install Node.js 0.10.x (0.10.15 when this project started)

	sudo apt-get update
	sudo apt-get upgrade
	sudo apt-get install g++ curl libssl-dev apache2-utils git-core
	sudo apt-get install make
	sudo apt-add-repository ppa:chris-lea/node.js
	sudo apt-get update 
	sudo apt-get install nodejs

###Install Mapnik ([original instructions](https://github.com/mapnik/mapnik/wiki/UbuntuInstallation))
(For Ubuntu 12 and 13, use the 2.2.0 ppa)

	--Mapnik 2.2.0, no support for Ubuntu 14 - trusty - yet
	sudo add-apt-repository ppa:mapnik/v2.2.0
	sudo apt-get update
	sudo apt-get install libmapnik libmapnik-dev mapnik-utils python-mapnik

(For Ubuntu 14, use the 2.2.3 ppa, since there is no ppa for trusty yet)

    sudo add-apt-repository ppa:mapnik/nightly-2.3
    sudo apt-get update
    sudo apt-get install libmapnik libmapnik-dev mapnik-utils python-mapnik
    # also install datasource plugins if you need them
    sudo apt-get install mapnik-input-plugin-gdal
    sudo apt-get install mapnik-input-plugin-postgis


###Clone with GIT (or download [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip) from GitHub)
    git clone https://github.com/spatialdev/PGRestAPI.git

###Navigate to PGRestAPI folder, and npm install
from the console:  
   
	cd PGRestAPI
	sudo npm install


###Run Stats on tables
Mapnik requires that statistics be generated for all spatial tables.
To do this use the DB Owner or superuser to run 

	VACUUM ANALYZE;

...in psql or PGAdminIII (or your favorite PostGreSQL client)

###Create settings.js file
Copy the settings.js.example file and update the postgres server name, port and username and password to point to your PostGreSQL instance.
	
	sudo cp settings.js.example settings.js

*For security reasons, it is recommended that you use a READ ONLY PostGreSQL User.*

	settings.pg.username = 'username';
	settings.pg.password = 'password';
	settings.pg.server = '127.0.0.1';
	settings.pg.port = '5432';
	settings.pg.database = 'test';

If you're using TileStream to serve static map caches, you can reference that instance:

	settings.tilestream.host = "54.212.254.185";
	settings.tilestream.path = "/api/Tileset";
	settings.tilestream.port = "8888";

If there are tables or views you don't want published, add them to the 'noFlyList' array:

	//Should the API hide any postgres tables or views?
	settings.pg.noFlyList = ["att_0", "table_1"];


###Run
Start the project (assuming installs have all succeeded and you've created the settings.js file)
	
	node app.js

###To Run as a 'service' (keeps running after you log off the machine), install forever module

	sudo npm install -g forever

### To run this project using forever:
cd to the PGRestAPI folder, then  
	
	sudo forever start app.js

### To restart forever service

	sudo forever restart 0

### To stop forever service

	sudo forever stop 0

###Alter Existing PostGres User to create Read Only User (if you don't already have one)
To grant read-only permissions for a user (assuming your user is already created):

	-- Grant access to current tables and views
	GRANT SELECT ON ALL TABLES IN SCHEMA public TO <username>;
	-- Now make sure that's also available on new tables and views by default
	ALTER DEFAULT PRIVILEGES
		IN SCHEMA public -- omit this line to make a default across all schemas
		GRANT SELECT
	ON TABLES
	TO <username>;

	-- Now do the same for sequences
	GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO <username>;
	ALTER DEFAULT PRIVILEGES
		IN SCHEMA public -- omit this line to make a default across all schemas
		GRANT SELECT, USAGE
	ON SEQUENCES
	TO <username>;

###Install local instance of pancakes yo …

Congratulations!  Everything you need should be installed.  Celebrate by having some Pancakes …

![Mou icon](http://173.201.28.147/pgRESTAPI/chubbs.JPG)
