PGRestAPI - OSX Installation
=========

## Dependencies

* [Mapnik](https://github.com/mapnik/mapnik)

(Assumes you've got a PostGreSQL 9.1+ and PostGIS 2.0+ is installed somewhere)

###Install Node.js 0.10.x (0.10.26 when this was updated)
	
	Installed from .pkg:
	http://nodejs.org/dist/v0.10.26/node-v0.10.26.pkg
	
###Install GDAL (for .shp outputs from queries)
Download package from http://www.kyngchaos.com/software/frameworks

Then:

    echo 'export PATH=/Library/Frameworks/GDAL.framework/Programs:$PATH' >> ~/.bash_profile
    source ~/.bash_profile

###Install Mapnik ([original instructions](https://github.com/mapnik/mapnik/wiki/MacInstallation_Homebrew))

	(assuming you have home-brew installed)
	brew install mapnik —-with gdal —-with-postgresql

###Clone with GIT (or download [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip) from GitHub)
    git clone https://github.com/spatialdev/PGRestAPI.git

###Navigate to PGRestAPI folder, and sudo npm install
from the console:  
   
	cd PGRestAPI
	sudo npm install

###Run Stats on tables
Mapnik requires that statistics be generated for all spatial tables in order for them to be rendered from PostGIS.
To do this use the DB Owner or superuser to run 

	VACUUM ANALYZE;

...in PostGres.

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

Specify whether to show PostGreSQL Views and Tables:

	//Should the API display postgres views?
	settings.displayViews = true;

	//Should the API display postgres tables?
	settings.displayTables = true;

If there are tables or views you don't want published, add them to the 'noFlyList' array:

	//Should the API hide any postgres tables or views?
	settings.pg.noFlyList = ["att_0", "table_1"];


###Run
Start the project (assuming installs have all succeeded and you've created the settings.js file)
	
	node app.js

###Install local instance of pancakes yo …

Congratulations!  Everything you need should be installed.  Celebrate by having some Pancakes …

![Mou icon](http://173.201.28.147/pgRESTAPI/chubbs.JPG)
