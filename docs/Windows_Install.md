PGRestAPI - Windows Installation
=========

## Dependencies

* (This project includes a reference to Mapnik.  If you can get it to install on Windows, congrats.  For those of us who can't yet, the install of node-mapnik will fail, but the rest of the project will still work.  You just won't get dyanmic tiled map services or vector tiles)

(Assumes you've got a PostGreSQL 9.1+ and PostGIS 2.0+ is installed somewhere)

###Install Node.js 0.10.x (0.10.15 when this project started)
Download the windows node installation package and run: http://nodejs.org/dist/v0.10.21/x64/node-v0.10.21-x64.msi

###Clone with GIT (or download [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip) from GitHub

    git clone https://github.com/spatialdev/PGRestAPI.git

-or-

extract files from [.zip file](https://github.com/spatialdev/PGRestAPI/archive/docs.zip) and copy to a PGRestAPI folder

###Navigate to PGRestAPI folder, and npm install
from the console:  

    npm install

**The node-mapnik install will almost certainly fail.  However, the rest of the project should install correctly.  Windows users won't be able to use the dynamic map services until the install of node-mapnik is figured out. 

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

If there are tables or views you don't want published, add them to the 'noFlyList' array:

	//Should the API hide any postgres tables or views?
	settings.pg.noFlyList = ["att_0", "table_1"];


On my windows installation, I use IIS URL Rewrite module to forward requests from a static IP or domain to "localhost:3000" (my node server and port).
These config sections help the API write out fully qualified URLs using the external IP or domain rather than localhost:3000 (for example, when displaying a hyperlink to a particular web service)

	//Optional.  If you're using port forwarding or URL rewriting, but need to display full URLs to your assets, this will stand in for the host.
	settings.application.publichost = "myhost.com"; //Keep this empty if you want to use the default host
	settings.application.publicport = "80";

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