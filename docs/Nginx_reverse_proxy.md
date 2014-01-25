PGRestAPI - Nginx Reverse Proxy configuration example
=========

Using Nginx will allow you to route requests to your server via port 80 to multiple instances of services running on various ports (port 3000 for example).

###Installing nginx as a front end to node apps.
	
	sudo apt-get install nginx

	--Start it
	sudo service nginx start
	
	--Add it to auto start
	update-rc.d nginx defaults

###Edit Configuration file (to set up routes)
(Replace all instances of <your project name> with your project name)
Create a file in /etc/nginx/sites-available/<your project name>

	sudo pico /etc/nginx/sites-available/<your project name>

	# the IP(s) on which your node server is running. I chose port 3000.
	upstream app_<your project name> {
		server 127.0.0.1:3000;
	}

	# the nginx server instance
	server {
		listen 0.0.0.0:80;
		server_name mydomain.com;
		access_log /var/log/nginx/<your project name>.log;

		# pass the request to the node.js server with the correct headers and much more can be added, see nginx config options
		location / {
		  proxy_set_header X-Real-IP $remote_addr;
		  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		  proxy_set_header Host $http_host;
		  proxy_set_header X-NginX-Proxy true;

		  proxy_pass http://app_<your project name>;
		  proxy_redirect off;
		}
	 }

	--Then enable the site defined above
	cd /etc/nginx/sites-enabled/ 
	sudo ln -s /etc/nginx/sites-available/<your project name> <your project name>


	--restart nginx
	sudo /etc/init.d/nginx restart