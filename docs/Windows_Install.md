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
Create a 'PGRestAPI' directory, then:
  
    git clone https://github.com/spatialdev/PGRestAPI.git

-or-

extract files from [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip) and copy to PGRestAPI folder

###Navigate to PGRestAPI folder, and npm install
from the console:  

    npm install

**This may fail due to a compilation error in the node_canvas module.  If this is the case, clone or copy the nodetiles-core module to a separate folder.
Then follow the instructions below for "Installing Cairo" and "Installing nodetiles-core", then return to this step and run "npm install"

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

If there are tables or views you don't want published, add them to the 'noFlyList' array:

	//Should the API hide any postgres tables or views?
	settings.pg.noFlyList = ["att_0", "table_1"];


Leave the TopoJSON and GeoJSON output folders as they are.

On my windows installation, I use IIS URL Rewrite module to forward requests from a static IP or domain to "localhost:3000" (my node server and port).
These config sections help the API write out fully qualified URLs using the external IP or domain rather than localhost:3000 (for example, when displaying a hyperlink to a particular web service)

	//Optional.  If you're using port forwarding or URL rewriting, but need to display full URLs to your assets, this will stand in for the host.
	settings.application.publichost = "myhost.com"; //Keep this empty if you want to use the default host
	settings.application.publicport = "80";



###Install topojson module globally
    npm install -g topojson

###For development purposes, install nodemon
Nodemon monitors your node project, and will automatically restart your node project if there are any file changes.
	npm install -g nodemon


###Installing Cairo (for dynamic map tile capability)
Cairo - You need to [download](http://www.gtk.org/download/index.php) and install Cairo in order to use the [nodetiles](https://github.com/nodetiles/nodetiles-core) dynamic tile rendering functionality.
For Windows, it seems the common way to do this is to install something called the GTK+ All-In-One package, which includes Cairo and other dependencies.
[Download](http://ftp.gnome.org/pub/gnome/binaries/win64/gtk+/2.22/gtk+-bundle_2.22.1-20101229_win64.zip) and install to C:/GTK (this is important) 

*I won't lie.  This and nodetiles-core was a bear to intall on Windows.*


###Installing nodetiles-core
[nodetiles-core](https://github.com/nodetiles/nodetiles-core) (on Windows, cloned or copied to a folder OUTSIDE of the PGRestAPI project).
Then move the entire nodetiles-core folder into PGRestAPI/node_modules

Next, copy cairo DLLs:   
After Cairo is installed, copy all dlls from C:\GTK\bin to PGRestAPI/node_modules/nodetiles-core/node_modules/canvas/build/Release.

Lastly, use npm install to install nodetiles-core  
So, cd into PGRestAPI/node_modules/nodetiles-core, and then

	npm install


With any luck, nodetiles-core should now be installed.


###Installing nodetiles-PostGIS
For the time being, this module is stored in the /PGRestAPI/lib folder.
Install this module by cd-ing into the /PGRestAPI/lib/nodetiles-postgis folder and then
	npm install


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


##Miscellaneous

If you encounter errors related to "git config returned wrong result" when installing modules, explicitly set the git.exe location like so: $ npm config set "git" "C:\path\to.exe" 

On a single Windows machine with multiple versions of .NET (2012 and 2010 for example), use:

	npm install <module name> --msvs_version=2012

...when installing modules or this project when using npm.  This tells npm which version of .NET to use when compiling modules that require it.

###Install local instance of pancakes yo …

Congratulations!  Everything you need should be installed.  Celebrate by having some Pancakes …

![Mou icon](http://173.201.28.147/pgRESTAPI/chubbs.JPG)