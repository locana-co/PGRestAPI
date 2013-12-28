#!/bin/bash

sudo apt-get install -y python-software-properties

sudo add-apt-repository ppa:mapnik/v2.2.0

sudo apt-get update

sudo apt-get install -y libmapnik libmapnik-dev mapnik-utils python-mapnik

