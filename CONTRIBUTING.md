# Contribute to balloon web client
Did you find a bug or would you like to contribute a feature? You are certainly welcome to do so.
Please always fill an [issue](https://github.com/gyselroth/balloon-client-web/issues/new) first to discuss the matter.
Do not start development without an open issue otherwise we do not know what you are working on.

## Bug
If you just want to fill a bug report, please open your [issue](https://github.com/gyselroth/balloon-client-web/issues/new).
We are encouraged to fix your reported bug to provide best software for the opensource community.

## Security flaw
Do not open an issue for a possible security vulnerability, to protect yourself and others please contact <opensource@gyselroth.net>
to report your concern.

## Git
You can clone the repository from:
```
git clone https://github.com/gyselroth/balloon-client-web.git
```
## Recomended setup for development

### Get the base and install dependencies
```
git clone https://github.com/gyselroth/balloon-client-web.git
npm install
```
### Balloon Server
You will need a balloon server to develop the web ui. Easiest way is to grap the [balloon docker image](https://github.com/gyselroth/balloon-dockerimage).
```
git clone https://github.com/gyselroth/balloon-dockerimage
cd balloon-dockerimage
docker build -t balloon .
cd ..
```

Clone the balloon server:
```
git clone https://github.com/gyselroth/balloon.git
```

Start the docker container and inject the local balloon server repository:
(Replace /path/to/balloon with the path where you cloned the balloon server repository)
```
docker run -p 8081:443 -v /path/to/balloon:/srv/www/balloon balloon
```

Install dependencies:
(Always execute build.sh via docker exec!)
```
docker exec efc12a87d00e /srv/www/balloon/build.sh --dep
```

### Start the magic
`npm start` will start a local development server, you can access the web ui at http://localhost:8080. If you cachange any file within the source,
your ui will automatically rebuild itself, you do not have to reload your browser, this will happen automatically.
```
npm start
```

## Git commit 
Please make sure that you always specify the number of your issue starting with a hastag (#) within any git commits.

## Pull Request
You are absolutely welcome to submit a pull request which references an open issue. Please make sure you're follwing coding standards
and be sure all your modifications pass the build.
[![Build Status](https://travis-ci.org/gyselroth/balloon-client-web.svg)](https://travis-ci.org/gyselroth/balloon-client-web)

## Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](https://github.com/gyselroth/balloon-client-web/CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## License
This software is freely available under the terms of [GPL-3.0](https://github.com/gyselroth/balloon-client-web/LICENSE), please respect this license
and do not contribute software which ist not compatible with GPL-3.0 or is not your work.

## Editor config
This repository gets shipped with an .editorconfig configuration. For more information on how to configure your editor please visit [editorconfig](https://github.com/editorconfig).

## Code policy
There are no javascript standards like PSR-1/2 for PHP, but please follow the following rules:

* Abstract classes named with an Abstract prefix: AbstractExample
* Interfaces named with an Interface suffix: ExampleInterface
* Variables named with underscore (_) and not camelCase
* Methods and classes follow the camelCase naming
* Always use 4 spaces for indentation
* Use "one true brace style" for blocks
* All non-module files delcare "use strict;"
* Always cache dom objects which will be used more than once: (`var $body = $('body');`)
* Add a $ prefix for variables containing a jquery object
* Always use i18next for output messages
* All api calls must use balloon.xmlHttpRequest()
