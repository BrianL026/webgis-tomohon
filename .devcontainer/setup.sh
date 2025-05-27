#!/bin/bash
# Download and set up GeoServer
GEOSERVER_VERSION="2.27.1"

mkdir -p ~/geoserver
cd ~/geoserver
curl -LO https://sourceforge.net/projects/geoserver/files/GeoServer/${GEOSERVER_VERSION}/geoserver-${GEOSERVER_VERSION}-bin.zip
unzip geoserver-${GEOSERVER_VERSION}-bin.zip
chmod +x ./geoserver-${GEOSERVER_VERSION}/bin/*.sh

# Setup Python HTTP server for serving static files
echo 'alias serve="python3 -m http.server"' >> ~/.bashrc

echo "Setup complete! GeoServer is ready to run."