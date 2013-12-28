#!/bin/bash

sudo wget https://protobuf.googlecode.com/files/protobuf-2.3.0.tar.gz
sudo tar xvf protobuf-2.3.0.tar.gz
cd protobuf-2.3.0
sudo ./configure
sudo make
sudo make install
cd python
sudo python setup.py install

sudo wget https://pypi.python.org/packages/2.7/s/setuptools/setuptools-0.6c11-py2.7.egg

sudo mv setuptools-0.6c11-py2.7.egg setuptools-0.6c9-py2.7.egg
sudo ldconfig

protoc --version

