# Build HTTP API Based Services using Amazon API Gateway, AWS PrivateLink, AWS Fargate and AWS CDK

## Architecture
<img width="1042" alt="architecture-screenshot" src="images/Architecture.png">
## Configure AWS Cloud9

### 1. Create AWS Cloud9 environment
It is recommended too create an AWS Cloud9 environment to run these code samples. Follow the instructions [here](https://docs.aws.amazon.com/cloud9/latest/user-guide/create-environment-main.html).

### 2. Resize AWS Cloud9 environment

You can also resize the Amazon Elastic Block Store (Amazon EBS) volume that is associated with an Amazon EC2 instance for an environment. The detailed steps are documented [here](https://docs.aws.amazon.com/cloud9/latest/user-guide/move-environment.html#move-environment-resize).

### 3. Upload the code sample folder to Cloud9

Use File/Upload Local Files ... from the Cloud9 menu to upload the code sample files ino the AWS Cloud9 environment.

## Deploy the code samples
The following commands should be run from the root of the code sample directory.

### 4. Install AWS CDK packages

`npm install`

### 5. Compile typescript files

`npm run build`

### 6. Synthesize CDK

`cdk synth`

### 7. Deploy the CDK stack

`cdk deploy`
