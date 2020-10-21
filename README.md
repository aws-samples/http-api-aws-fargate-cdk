# Build HTTP API Based Services using Amazon API Gateway, AWS PrivateLink, AWS Fargate and AWS CDK
[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)
[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/aws/aws-cdk)
[![NPM version](https://badge.fury.io/js/aws-cdk.svg)](https://badge.fury.io/js/aws-cdk)
[![PyPI version](https://badge.fury.io/py/aws-cdk.core.svg)](https://badge.fury.io/py/aws-cdk.core)
[![NuGet version](https://badge.fury.io/nu/Amazon.CDK.svg)](https://badge.fury.io/nu/Amazon.CDK)

## Architecture
<img width="1042" alt="architecture-screenshot" src="images/Architecture.png">

## Configure AWS Cloud9
[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)
####   Create AWS Cloud9 environment
  - It is recommended too create an AWS Cloud9 environment to run these code samples. Follow the instructions [here](https://docs.aws.amazon.com/cloud9/latest/user-guide/create-environment-main.html).

####   Resize AWS Cloud9 environment

  - You can also resize the Amazon Elastic Block Store (Amazon EBS) volume that is associated with an Amazon EC2 instance for an environment. The detailed steps are documented [here](https://docs.aws.amazon.com/cloud9/latest/user-guide/move-environment.html#move-environment-resize).

####   Upload the code sample folder to Cloud9

  - Use File/Upload Local Files ... from the Cloud9 menu to upload the code sample files ino the AWS Cloud9 environment.

## Deploy the code samples
  - The following commands should be run from the root of the code sample directory.

####   Install AWS CDK packages

   ```bash
   npm install
   ```

####   Compile typescript files

  ```bash
  npm run build
  ```
  
#### Bootstrap an environment
```bash
 cdk bootstrap
```

#### Deploy the stack
```bash
 cdk synth
 cdk deploy
```
