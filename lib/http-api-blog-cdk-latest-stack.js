"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpApiBlogCdkLatestStack = void 0;
// import * as cdk from '@aws-cdk/core';
const cdk = require("@aws-cdk/core");
const elbv2 = require("@aws-cdk/aws-elasticloadbalancingv2");
const ec2 = require("@aws-cdk/aws-ec2");
const ecs = require("@aws-cdk/aws-ecs");
const iam = require("@aws-cdk/aws-iam");
const logs = require("@aws-cdk/aws-logs");
const apig = require("@aws-cdk/aws-apigatewayv2");
class HttpApiBlogCdkLatestStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // The code that defines your stack goes here
        // VPC
        const vpc = new ec2.Vpc(this, 'VPC');
        // ECS Cluster
        const cluster = new ecs.Cluster(this, "Fargate Cluster", {
            vpc: vpc,
        });
        // Cloud Map Namespace
        cluster.addDefaultCloudMapNamespace({ name: 'http-api' });
        // Task Role
        const taskrole = new iam.Role(this, 'ecsTaskExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
        });
        taskrole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));
        // Task Definitions
        const bookServiceTaskDefinition = new ecs.FargateTaskDefinition(this, 'bookServiceTaskDef', {
            memoryLimitMiB: 512,
            cpu: 256,
            taskRole: taskrole
        });
        const authorServiceTaskDefinition = new ecs.FargateTaskDefinition(this, 'authorServiceTaskDef', {
            memoryLimitMiB: 512,
            cpu: 256,
            taskRole: taskrole
        });
        // Log Groups
        const bookServiceLogGroup = new logs.LogGroup(this, "bookServiceLogGroup", {
            logGroupName: "/ecs/BookService",
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        const authorServiceLogGroup = new logs.LogGroup(this, "authorServiceLogGroup", {
            logGroupName: "/ecs/AuthorService",
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        const bookServiceLogDriver = new ecs.AwsLogDriver({
            logGroup: bookServiceLogGroup,
            streamPrefix: "BookService"
        });
        const authorServiceLogDriver = new ecs.AwsLogDriver({
            logGroup: authorServiceLogGroup,
            streamPrefix: "AuthorService"
        });
        // Amazon ECR Repositories
        // const bookservicerepo = new ecr.Repository(this, 'bookservice', {repositoryName:'bookservice'});
        // const authorservicerepo = new ecr.Repository(this, 'authorservice', {repositoryName:'authorservice'});
        // Task Containers
        const bookServiceContainer = bookServiceTaskDefinition.addContainer("bookServiceContainer", {
            // image: ecs.ContainerImage.fromEcrRepository(bookservicerepo),
            image: ecs.ContainerImage.fromRegistry('ibuchh/book-service'),
            logging: bookServiceLogDriver
        });
        const authorServiceContainer = authorServiceTaskDefinition.addContainer("authorServiceContainer", {
            // image: ecs.ContainerImage.fromEcrRepository(authorservicerepo),
            image: ecs.ContainerImage.fromRegistry('ibuchh/author-service'),
            logging: authorServiceLogDriver
        });
        bookServiceContainer.addPortMappings({
            containerPort: 80
        });
        authorServiceContainer.addPortMappings({
            containerPort: 80
        });
        //Security Groups
        const bookServiceSecGrp = new ec2.SecurityGroup(this, "bookServiceSecurityGroup", {
            allowAllOutbound: true,
            securityGroupName: 'bookServiceSecurityGroup',
            vpc: vpc
        });
        bookServiceSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
        const authorServiceSecGrp = new ec2.SecurityGroup(this, "authorServiceSecurityGroup", {
            allowAllOutbound: true,
            securityGroupName: 'authorServiceSecurityGroup',
            vpc: vpc
        });
        authorServiceSecGrp.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
        // Fargate Services
        const bookService = new ecs.FargateService(this, 'bookService', {
            cluster: cluster,
            taskDefinition: bookServiceTaskDefinition,
            assignPublicIp: false,
            desiredCount: 2,
            securityGroup: bookServiceSecGrp,
            cloudMapOptions: {
                name: 'bookService'
            }
        });
        const authorService = new ecs.FargateService(this, 'authorService', {
            cluster: cluster,
            taskDefinition: authorServiceTaskDefinition,
            assignPublicIp: false,
            desiredCount: 2,
            securityGroup: authorServiceSecGrp
        });
        // ALB
        const httpapiInternalALB = new elbv2.ApplicationLoadBalancer(this, 'httpapiInternalALB', {
            vpc: vpc,
            internetFacing: false
        });
        // ALB Listener
        const httpapiListener = httpapiInternalALB.addListener('httpapiListener', {
            port: 80,
            // Default Target Group
            defaultAction: elbv2.ListenerAction.fixedResponse(200)
        });
        // Target Groups
        const bookServiceTargetGroup = httpapiListener.addTargets('bookServiceTargetGroup', {
            port: 80,
            priority: 1,
            healthCheck: {
                path: '/api/books/health',
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(3)
            },
            targets: [bookService],
            pathPattern: '/api/books*'
        });
        const authorServiceTargetGroup = httpapiListener.addTargets('authorServiceTargetGroup', {
            port: 80,
            priority: 2,
            healthCheck: {
                path: '/api/authors/health',
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(3)
            },
            targets: [authorService],
            pathPattern: '/api/authors*'
        });
        //VPC Link
        const httpVpcLink = new cdk.CfnResource(this, "HttpVpcLink", {
            type: "AWS::ApiGatewayV2::VpcLink",
            properties: {
                Name: "http-api-vpclink",
                SubnetIds: vpc.privateSubnets.map(m => m.subnetId)
            }
        });
        // HTTP API
        const api = new apig.HttpApi(this, "http-api", {
            createDefaultStage: true
        });
        // API Integration
        const integration = new apig.CfnIntegration(this, "HttpApiGatewayIntegration", {
            apiId: api.httpApiId,
            connectionId: httpVpcLink.ref,
            connectionType: "VPC_LINK",
            description: "API Integration",
            integrationMethod: "ANY",
            integrationType: "HTTP_PROXY",
            integrationUri: httpapiListener.listenerArn,
            payloadFormatVersion: "1.0",
        });
        // API Route
        new apig.CfnRoute(this, 'Route', {
            apiId: api.httpApiId,
            routeKey: 'ANY /{proxy+}',
            target: `integrations/${integration.ref}`,
        });
        new cdk.CfnOutput(this, 'ALBDNS: ', { value: httpapiInternalALB.loadBalancerDnsName });
    }
}
exports.HttpApiBlogCdkLatestStack = HttpApiBlogCdkLatestStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1hcGktYmxvZy1jZGstbGF0ZXN0LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaHR0cC1hcGktYmxvZy1jZGstbGF0ZXN0LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHdDQUF3QztBQUN4QyxxQ0FBcUM7QUFDckMsNkRBQTZEO0FBQzdELHdDQUF3QztBQUN4Qyx3Q0FBd0M7QUFFeEMsd0NBQXdDO0FBQ3hDLDBDQUEwQztBQUMxQyxrREFBa0Q7QUFFbEQsTUFBYSx5QkFBMEIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN0RCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDZDQUE2QztRQUU3QyxNQUFNO1FBQ04sTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBQyxLQUFLLENBQUMsQ0FBQztRQUVwQyxjQUFjO1FBQ2QsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN2RCxHQUFHLEVBQUcsR0FBRztTQUNWLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUV0QixPQUFPLENBQUMsMkJBQTJCLENBQUMsRUFBQyxJQUFJLEVBQUUsVUFBVSxFQUFDLENBQUMsQ0FBQTtRQUV2RCxZQUFZO1FBQ1osTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUMxRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMseUJBQXlCLENBQUM7U0FDL0QsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsK0NBQStDLENBQUMsQ0FBQyxDQUFBO1FBRXRILG1CQUFt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Q2xCLE1BQU0sV0FBVyxHQUFHLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDN0UsS0FBSyxFQUFFLEdBQUcsQ0FBQyxTQUFTO1lBQ3BCLFlBQVksRUFBRSxXQUFXLENBQUMsR0FBRztZQUM3QixjQUFjLEVBQUUsVUFBVTtZQUMxQixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsZUFBZSxFQUFFLFlBQVk7WUFDN0IsY0FBYyxFQUFFLGVBQWUsQ0FBQyxXQUFXO1lBQzNDLG9CQUFvQixFQUFFLEtBQUs7U0FDNUIsQ0FBQyxDQUFDO1FBRUgsWUFBWTtRQUNaLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQy9CLEtBQUssRUFBRSxHQUFHLENBQUMsU0FBUztZQUNwQixRQUFRLEVBQUUsZUFBZTtZQUN6QixNQUFNLEVBQUUsZ0JBQWdCLFdBQVcsQ0FBQyxHQUFHLEVBQUU7U0FDMUMsQ0FBQyxDQUFBO1FBQ0YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsa0JBQWtCLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO0lBRXpGLENBQUM7Q0FDRjtBQXZNRCw4REF1TUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tICdAYXdzLWNkay9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnQGF3cy1jZGsvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnQGF3cy1jZGsvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnQGF3cy1jZGsvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ0Bhd3MtY2RrL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGFwaWcgZnJvbSAnQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXl2Mic7XG5cbmV4cG9ydCBjbGFzcyBIdHRwQXBpQmxvZ0Nka0xhdGVzdFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFRoZSBjb2RlIHRoYXQgZGVmaW5lcyB5b3VyIHN0YWNrIGdvZXMgaGVyZVxuICAgIFxuICAgIC8vIFZQQ1xuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsJ1ZQQycpO1xuICAgIFxuICAgIC8vIEVDUyBDbHVzdGVyXG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCBcIkZhcmdhdGUgQ2x1c3RlclwiICx7XG4gICAgICB2cGMgOiB2cGMsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ2xvdWQgTWFwIE5hbWVzcGFjZVxuICAgIFxuICAgIGNsdXN0ZXIuYWRkRGVmYXVsdENsb3VkTWFwTmFtZXNwYWNlKHtuYW1lOiAnaHR0cC1hcGknfSlcbiAgICBcbiAgICAvLyBUYXNrIFJvbGVcbiAgICBjb25zdCB0YXNrcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnZWNzVGFza0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKVxuICAgIH0pO1xuICAgIFxuICAgIHRhc2tyb2xlLmFkZE1hbmFnZWRQb2xpY3koaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knKSlcbiAgICBcbiAgICAvLyBUYXNrIERlZmluaXRpb25zXG4gICAgY29uc3QgYm9va1NlcnZpY2VUYXNrRGVmaW5pdGlvbiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKHRoaXMsICdib29rU2VydmljZVRhc2tEZWYnLCB7XG4gICAgICBtZW1vcnlMaW1pdE1pQjogNTEyLFxuICAgICAgY3B1OiAyNTYsXG4gICAgICB0YXNrUm9sZTogdGFza3JvbGVcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBhdXRob3JTZXJ2aWNlVGFza0RlZmluaXRpb24gPSBuZXcgZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbih0aGlzLCAnYXV0aG9yU2VydmljZVRhc2tEZWYnLCB7XG4gICAgICBtZW1vcnlMaW1pdE1pQjogNTEyLFxuICAgICAgY3B1OiAyNTYsXG4gICAgICB0YXNrUm9sZTogdGFza3JvbGVcbiAgICB9KTtcbiAgICBcbiAgICAvLyBMb2cgR3JvdXBzXG4gICAgY29uc3QgYm9va1NlcnZpY2VMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiYm9va1NlcnZpY2VMb2dHcm91cFwiLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IFwiL2Vjcy9Cb29rU2VydmljZVwiLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IGF1dGhvclNlcnZpY2VMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIFwiYXV0aG9yU2VydmljZUxvZ0dyb3VwXCIsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogXCIvZWNzL0F1dGhvclNlcnZpY2VcIixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBib29rU2VydmljZUxvZ0RyaXZlciA9IG5ldyBlY3MuQXdzTG9nRHJpdmVyKHtcbiAgICAgICAgbG9nR3JvdXA6IGJvb2tTZXJ2aWNlTG9nR3JvdXAsXG4gICAgICAgIHN0cmVhbVByZWZpeDogXCJCb29rU2VydmljZVwiXG4gICAgICB9KTtcbiAgICAgIFxuICAgIGNvbnN0IGF1dGhvclNlcnZpY2VMb2dEcml2ZXIgPSBuZXcgZWNzLkF3c0xvZ0RyaXZlcih7XG4gICAgICAgIGxvZ0dyb3VwOiBhdXRob3JTZXJ2aWNlTG9nR3JvdXAsXG4gICAgICAgIHN0cmVhbVByZWZpeDogXCJBdXRob3JTZXJ2aWNlXCJcbiAgICAgIH0pO1xuICAgIFxuICAgIC8vIEFtYXpvbiBFQ1IgUmVwb3NpdG9yaWVzXG4gICAgLy8gY29uc3QgYm9va3NlcnZpY2VyZXBvID0gbmV3IGVjci5SZXBvc2l0b3J5KHRoaXMsICdib29rc2VydmljZScsIHtyZXBvc2l0b3J5TmFtZTonYm9va3NlcnZpY2UnfSk7XG4gICAgXG4gICAgLy8gY29uc3QgYXV0aG9yc2VydmljZXJlcG8gPSBuZXcgZWNyLlJlcG9zaXRvcnkodGhpcywgJ2F1dGhvcnNlcnZpY2UnLCB7cmVwb3NpdG9yeU5hbWU6J2F1dGhvcnNlcnZpY2UnfSk7XG4gICAgXG4gICAgLy8gVGFzayBDb250YWluZXJzXG4gICAgY29uc3QgYm9va1NlcnZpY2VDb250YWluZXIgPSBib29rU2VydmljZVRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcihcImJvb2tTZXJ2aWNlQ29udGFpbmVyXCIsIHtcbiAgICAgIC8vIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoYm9va3NlcnZpY2VyZXBvKSxcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KCdpYnVjaGgvYm9vay1zZXJ2aWNlJyksXG4gICAgICBsb2dnaW5nOiBib29rU2VydmljZUxvZ0RyaXZlclxuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IGF1dGhvclNlcnZpY2VDb250YWluZXIgPSBhdXRob3JTZXJ2aWNlVGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKFwiYXV0aG9yU2VydmljZUNvbnRhaW5lclwiLCB7XG4gICAgICAvLyBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KGF1dGhvcnNlcnZpY2VyZXBvKSxcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KCdpYnVjaGgvYXV0aG9yLXNlcnZpY2UnKSxcbiAgICAgIGxvZ2dpbmc6IGF1dGhvclNlcnZpY2VMb2dEcml2ZXJcbiAgICB9KTtcbiAgICBcbiAgICBib29rU2VydmljZUNvbnRhaW5lci5hZGRQb3J0TWFwcGluZ3Moe1xuICAgICAgY29udGFpbmVyUG9ydDogODBcbiAgICB9KTtcbiAgICBcbiAgICBhdXRob3JTZXJ2aWNlQ29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICBjb250YWluZXJQb3J0OiA4MFxuICAgIH0pO1xuICAgIFxuICAgIFxuICAgIC8vU2VjdXJpdHkgR3JvdXBzXG4gICAgY29uc3QgYm9va1NlcnZpY2VTZWNHcnAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgXCJib29rU2VydmljZVNlY3VyaXR5R3JvdXBcIiwge1xuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiAnYm9va1NlcnZpY2VTZWN1cml0eUdyb3VwJyxcbiAgICAgIHZwYzogdnBjXG4gICAgfSk7XG4gICAgXG4gICAgYm9va1NlcnZpY2VTZWNHcnAuY29ubmVjdGlvbnMuYWxsb3dGcm9tQW55SXB2NChlYzIuUG9ydC50Y3AoODApKVxuICAgIFxuICAgIGNvbnN0IGF1dGhvclNlcnZpY2VTZWNHcnAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgXCJhdXRob3JTZXJ2aWNlU2VjdXJpdHlHcm91cFwiLCB7XG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdhdXRob3JTZXJ2aWNlU2VjdXJpdHlHcm91cCcsXG4gICAgICB2cGM6IHZwY1xuICAgIH0pO1xuICAgIFxuICAgIGF1dGhvclNlcnZpY2VTZWNHcnAuY29ubmVjdGlvbnMuYWxsb3dGcm9tQW55SXB2NChlYzIuUG9ydC50Y3AoODApKVxuICAgIFxuICAgIFxuICAgIC8vIEZhcmdhdGUgU2VydmljZXNcbiAgICBjb25zdCBib29rU2VydmljZSA9IG5ldyBlY3MuRmFyZ2F0ZVNlcnZpY2UodGhpcywgJ2Jvb2tTZXJ2aWNlJywgeyBcbiAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICB0YXNrRGVmaW5pdGlvbjogYm9va1NlcnZpY2VUYXNrRGVmaW5pdGlvbixcbiAgICAgIGFzc2lnblB1YmxpY0lwOiBmYWxzZSxcbiAgICAgIGRlc2lyZWRDb3VudDogMixcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGJvb2tTZXJ2aWNlU2VjR3JwLFxuICAgICAgY2xvdWRNYXBPcHRpb25zOiB7XG4gICAgICAgIG5hbWU6ICdib29rU2VydmljZSdcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBhdXRob3JTZXJ2aWNlID0gbmV3IGVjcy5GYXJnYXRlU2VydmljZSh0aGlzLCAnYXV0aG9yU2VydmljZScsIHsgXG4gICAgICBjbHVzdGVyOiBjbHVzdGVyLFxuICAgICAgdGFza0RlZmluaXRpb246IGF1dGhvclNlcnZpY2VUYXNrRGVmaW5pdGlvbixcbiAgICAgIGFzc2lnblB1YmxpY0lwOiBmYWxzZSxcbiAgICAgIGRlc2lyZWRDb3VudDogMixcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGF1dGhvclNlcnZpY2VTZWNHcnBcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBTEJcbiAgICBjb25zdCBodHRwYXBpSW50ZXJuYWxBTEIgPSBuZXcgZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXIodGhpcywgJ2h0dHBhcGlJbnRlcm5hbEFMQicsIHtcbiAgICAgIHZwYzogdnBjLFxuICAgICAgaW50ZXJuZXRGYWNpbmc6IGZhbHNlXG4gICAgfSk7XG4gICAgXG4gICAgXG4gICAgLy8gQUxCIExpc3RlbmVyXG4gICAgY29uc3QgaHR0cGFwaUxpc3RlbmVyID0gaHR0cGFwaUludGVybmFsQUxCLmFkZExpc3RlbmVyKCdodHRwYXBpTGlzdGVuZXInLCB7XG4gICAgICBwb3J0OiA4MCxcbiAgICAgIC8vIERlZmF1bHQgVGFyZ2V0IEdyb3VwXG4gICAgICBkZWZhdWx0QWN0aW9uOiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5maXhlZFJlc3BvbnNlKDIwMClcbiAgICB9KTtcbiAgICBcbiAgICBcbiAgICAvLyBUYXJnZXQgR3JvdXBzXG4gICAgY29uc3QgYm9va1NlcnZpY2VUYXJnZXRHcm91cCA9IGh0dHBhcGlMaXN0ZW5lci5hZGRUYXJnZXRzKCdib29rU2VydmljZVRhcmdldEdyb3VwJywge1xuICAgICAgICBwb3J0OiA4MCxcbiAgICAgICAgcHJpb3JpdHk6IDEsXG4gICAgICAgIGhlYWx0aENoZWNrOntcbiAgICAgICAgICBwYXRoOiAnL2FwaS9ib29rcy9oZWFsdGgnLFxuICAgICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMylcbiAgICAgICAgfSxcbiAgICAgICAgdGFyZ2V0czogW2Jvb2tTZXJ2aWNlXSxcbiAgICAgICAgcGF0aFBhdHRlcm46ICcvYXBpL2Jvb2tzKidcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBhdXRob3JTZXJ2aWNlVGFyZ2V0R3JvdXAgPSBodHRwYXBpTGlzdGVuZXIuYWRkVGFyZ2V0cygnYXV0aG9yU2VydmljZVRhcmdldEdyb3VwJywge1xuICAgICAgICBwb3J0OiA4MCxcbiAgICAgICAgcHJpb3JpdHk6IDIsXG4gICAgICAgIGhlYWx0aENoZWNrOntcbiAgICAgICAgICBwYXRoOiAnL2FwaS9hdXRob3JzL2hlYWx0aCcsXG4gICAgICAgICAgaW50ZXJ2YWwgOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMylcbiAgICAgICAgfSxcbiAgICAgICAgdGFyZ2V0czogW2F1dGhvclNlcnZpY2VdLFxuICAgICAgICBwYXRoUGF0dGVybjogJy9hcGkvYXV0aG9ycyonXG4gICAgfSk7XG4gICAgXG4gICAgLy9WUEMgTGlua1xuICAgIGNvbnN0IGh0dHBWcGNMaW5rID0gbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCBcIkh0dHBWcGNMaW5rXCIsIHtcbiAgICAgIHR5cGU6IFwiQVdTOjpBcGlHYXRld2F5VjI6OlZwY0xpbmtcIixcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgTmFtZTogXCJodHRwLWFwaS12cGNsaW5rXCIsXG4gICAgICAgIFN1Ym5ldElkczogdnBjLnByaXZhdGVTdWJuZXRzLm1hcChtID0+IG0uc3VibmV0SWQpXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8gSFRUUCBBUElcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZy5IdHRwQXBpKHRoaXMsIFwiaHR0cC1hcGlcIiwge1xuICAgICAgY3JlYXRlRGVmYXVsdFN0YWdlOiB0cnVlXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQVBJIEludGVncmF0aW9uXG4gICAgY29uc3QgaW50ZWdyYXRpb24gPSBuZXcgYXBpZy5DZm5JbnRlZ3JhdGlvbih0aGlzLCBcIkh0dHBBcGlHYXRld2F5SW50ZWdyYXRpb25cIiwge1xuICAgICAgYXBpSWQ6IGFwaS5odHRwQXBpSWQsXG4gICAgICBjb25uZWN0aW9uSWQ6IGh0dHBWcGNMaW5rLnJlZixcbiAgICAgIGNvbm5lY3Rpb25UeXBlOiBcIlZQQ19MSU5LXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUEkgSW50ZWdyYXRpb25cIixcbiAgICAgIGludGVncmF0aW9uTWV0aG9kOiBcIkFOWVwiLFxuICAgICAgaW50ZWdyYXRpb25UeXBlOiBcIkhUVFBfUFJPWFlcIixcbiAgICAgIGludGVncmF0aW9uVXJpOiBodHRwYXBpTGlzdGVuZXIubGlzdGVuZXJBcm4sXG4gICAgICBwYXlsb2FkRm9ybWF0VmVyc2lvbjogXCIxLjBcIixcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBUEkgUm91dGVcbiAgICBuZXcgYXBpZy5DZm5Sb3V0ZSh0aGlzLCAnUm91dGUnLCB7XG4gICAgICBhcGlJZDogYXBpLmh0dHBBcGlJZCxcbiAgICAgIHJvdXRlS2V5OiAnQU5ZIC97cHJveHkrfScsXG4gICAgICB0YXJnZXQ6IGBpbnRlZ3JhdGlvbnMvJHtpbnRlZ3JhdGlvbi5yZWZ9YCxcbiAgICB9KVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBTEJETlM6ICcsIHsgdmFsdWU6IGh0dHBhcGlJbnRlcm5hbEFMQi5sb2FkQmFsYW5jZXJEbnNOYW1lIH0pO1xuICAgIFxuICB9XG59XG4iXX0=