## Deploy AWS CodePipeline artifacts to S3

Unwraps compressed input artifact(s) and deploys the files to an S3 bucket with mime types. It attempts to only deploy modified files by checking S3 object Etag against the md5 hash of the data. You can optionally invalidate CloudFront after deployment.

#### You probably don't need this!

You can simply use [`aws s3 sync`](https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html) and [`aws cloudfront create-invalidation`](https://docs.aws.amazon.com/cli/latest/reference/cloudfront/create-invalidation.html) in AWS CodeBuild

#### Optional parameters

```
{
    "prefix": "",
    "invalidate": false,
    "distributionId": "",
    "targetBucketName": ""
}
```
* **prefix** (*not required*): deploy all files to S3 under that prefix (or "folder"). The prefix must end with a `/` and will be prepended to path of uploaded files.
* **invalidate**: (*not required*): Enable CloudFront invalidation after deployment.
* **distributionId** (*required if invalidate is set to true*)
* **targetBucketName**: (*not required*): Override target or deployment bucket set by Cloudformation template. Ensure you have IAM permissions to access new bucket.

Example:
```
{"prefix": "stuff/", "invalidate": true, "distributionId": "E12ABCDEF4TEST", "targetBucketName": "some-bucket"}
```

#### Deployment

1. [AWS Application Repository](https://serverlessrepo.aws.amazon.com/#/applications/arn:aws:serverlessrepo:us-east-1:775015977546:applications~codepipeline-s3-deploy) - limited by SAM policy templates (template-sam.yml)
2. Manual through aws cli or sam cli (template.yml).

Deploy manually - substitute `???` with bucket names and the region being used.

```
yarn -i
//or npm install

yarn build
//or npm run build

aws cloudformation package --template-file ./dist/template.yml --s3-bucket ??? --output-template-file ./dist/packaged.yml

aws cloudformation deploy --template-file ./dist/packaged.yml --stack-name codepipeline-s3-deploy --capabilities CAPABILITY_NAMED_IAM --parameter-overrides FunctionName=CodePipelineS3Deploy TargetBucket=??? ArtifactStore=??? --region=???
```

or edit package.json

```
yarn build && yarn package && yarn deploy
```

#### Tests
* Test decompression
* Test deployment flow to S3 (requires access to a test S3 bucket)
* No test for optional parameters.
* No test for main index.js workflow

#### Limitations & Notes
* Etag / md5 checking doesn't work on server side encrypted objects.
* You can't create a pipeline in CodePipeline without having at least a CodeDeploy or CodeBuild stage (in case you want to pipe S3 source direct to this function) but you can workaround it by creating a CodeBuild stage as the last stage then "Disable transition" through the arrow between stages in CodePipeline's console.
* AWS Application Repository - you have to manually add missing IAM permissions included in `template.yml` but not `template-sam.yml` for CodePipeline (until a AWS SAM bug is fixed) and optionally for CloudFront if you wish to use invalidation.
* Limit S3 IAM permissions if using `template.yml` from Resource "*" to ARNs of the buckets used.
