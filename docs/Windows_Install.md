PGRestAPI - Windows Installation
=========

## Dependencies

* PostGres 9.1 + w/ PostGIS 2.0 +
* topojson
* Cairo - You need to [download](http://www.gtk.org/download/index.php) and install Cairo in order to use the [nodetiles](https://github.com/nodetiles/nodetiles-core) dynamic tile rendering functionality.
* nodetiles-core (on Windows, cloned and built on it's own, then copied to PGRestAPI/node_modules folder)

(Assumes you've got a PostGreSQL 9.1+ and PostGIS 2.0+ is installed somewhere)

###Install Node.js 0.10.x (0.10.15 when this project started)
Download the windows node installation package and run: http://nodejs.org/dist/v0.10.21/x64/node-v0.10.21-x64.msi

###Create a directory for the project and clone with GIT (or download [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip) from GitHub
Create a 'PGRestAPI' directory  
	git clone https://github.com/spatialdev/PGRestAPI.git

-or-

extract files from [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip

###Navigate to PGRestAPI folder, and npm install
from the console:
	npm install

###Create PostGreSQL Read Only User
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

###Create settings.js file
Copy the settings.js.example file and update the postgres server name, port and username and password to point to your PostGreSQL instance.
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

If there are tables are views you don't want published, add them to the 'noFlyList' array:

	//Should the API hide any postgres tables or views?
	settings.pg.noFlyList = ["att_0", "table_1"];


Leave the TopoJSON and GeoJSON output folders as they are.

On my windows installation, I use IIS URL Rewrite module to forward requests from a static IP or domain to "localhost:3000" (my node server and port).
These config sections help node write out fully qualified URLs using the external IP or domain rather than localhost:3000

	//Optional.  If you're using port forwarding or URL rewriting, but need to display full URLs to your assets, this will stand in for the host.
	settings.application.publichost = "myhost.com"; //Keep this empty if you want to use the default host
	settings.application.publicport = "80";



###Install topojson module globally
    npm install -g topojson

###For development purposes, install nodemon
	npm install -g nodemon


###Installing Cairo (for dynamic map tile capability)
Cairo - You need to [download](http://www.gtk.org/download/index.php) and install Cairo in order to use the [nodetiles](https://github.com/nodetiles/nodetiles-core) dynamic tile rendering functionality.



###Installing nodetiles-core
nodetiles-core (on Windows, cloned and built on it's own, then copied to PGRestAPI/node_modules folder)




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




if you encounter errors related to "git config returned wrong result" when installing modules, explicitly set the git.exe location like so: $ npm config set "git" "C:\path\to.exe" 

On Windows with multiple versions of .NET, use:
npm install pg --msvs_version=2012

