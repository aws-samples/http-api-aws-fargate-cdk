import * as cdk from "@aws-cdk/core";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as logs from "@aws-cdk/aws-logs";
import * as apig from "@aws-cdk/aws-apigatewayv2";

export class HttpApiStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    httpVpcLink: cdk.CfnResource,
    httpApiListener: elbv2.ApplicationListener,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // Consumer VPC
    const vpc = new ec2.Vpc(this, "ConsumerVPC", {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    //Security Group
    const bastionSecGrp = new ec2.SecurityGroup(this, "bastionSecGrp", {
      allowAllOutbound: true,
      securityGroupName: "bastionSecGrp",
      vpc: vpc,
    });

    bastionSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(22));

    // AMI
    const amz_linux = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
    });

    // Instance
    const instance = new ec2.Instance(this, "BastionHost", {
      instanceType: new ec2.InstanceType("t3.nano"),
      machineImage: amz_linux,
      vpc: vpc,
      securityGroup: bastionSecGrp,
      keyName: "ssh-key",
    });

    // HTTP API
    const api = new apig.HttpApi(this, "http-api", {
      createDefaultStage: true,
    });

    // API Integration
    const integration = new apig.CfnIntegration(
      this,
      "HttpApiGatewayIntegration",
      {
        apiId: api.httpApiId,
        connectionId: httpVpcLink.ref,
        connectionType: "VPC_LINK",
        description: "API Integration",
        integrationMethod: "ANY",
        integrationType: "HTTP_PROXY",
        integrationUri: httpApiListener.listenerArn,
        payloadFormatVersion: "1.0",
      }
    );

    // API Route
    new apig.CfnRoute(this, "Route", {
      apiId: api.httpApiId,
      routeKey: "ANY /{proxy+}",
      target: `integrations/${integration.ref}`,
    });

    // EC2 instance ip address
    new cdk.CfnOutput(this, "EC2 public ip address: ", {
      value: instance.instancePublicIp,
    });

    // API and Service Endpoints
    const httpApiEndpoint = api.apiEndpoint;
    const bookServiceEndpoint = httpApiEndpoint + "/api/books";
    const authorServiceEndpoint = httpApiEndpoint + "/api/authors";

    new cdk.CfnOutput(this, "HTTP API endpoint: ", {
      value: httpApiEndpoint,
    });
    new cdk.CfnOutput(this, "Book Service: ", {
      value: bookServiceEndpoint,
    });
    new cdk.CfnOutput(this, "Author Service: ", {
      value: authorServiceEndpoint,
    });
  }
}
