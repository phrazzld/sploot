# Replicate API Setup Guide

This guide will help you set up Replicate for generating SigLIP embeddings in Sploot.

## What is Replicate?

Replicate is a platform that lets you run machine learning models in the cloud. We use it to run SigLIP (Sigmoid loss for language-image pre-training), which generates embeddings for both text and images, enabling semantic search functionality.

## Setup Steps

### 1. Create a Replicate Account

1. Go to [replicate.com](https://replicate.com)
2. Click "Sign up" in the top right
3. Sign up with GitHub, Google, or email

### 2. Get Your API Token

1. Once logged in, go to [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. Click "Create token"
3. Give it a name like "sploot-embeddings"
4. Copy the token (it starts with `r8_`)

### 3. Configure Environment Variable

Add your Replicate API token to `.env.local`:

```env
REPLICATE_API_TOKEN=r8_your_actual_token_here
```

### 4. Verify the Setup

You can test the embedding service by running the development server and checking the console:

```bash
pnpm dev
```

If configured correctly, you should see no warnings about missing Replicate configuration.

## Model Information

We use the SigLIP Large Patch16-384 model:
- **Model**: `daanelson/siglip-large-patch16-384`
- **Embedding dimension**: 1152
- **Supports**: Both text and image inputs
- **Use case**: Semantic similarity search

## Pricing

Replicate charges based on compute time:
- First $10 of usage is free each month
- SigLIP typically costs ~$0.0002 per embedding
- With 5,000 images, expect ~$1 in usage

## Troubleshooting

### "Replicate API token not configured" Error
- Make sure you've added `REPLICATE_API_TOKEN` to `.env.local`
- Ensure the token starts with `r8_`
- Restart the development server after adding the token

### Rate Limiting
- Replicate has rate limits on the free tier
- If you hit limits, consider upgrading or implementing caching

### Slow Embeddings
- First requests may be slower as the model "cold starts"
- Subsequent requests should be faster (~1-2 seconds)
- Consider implementing batch processing for multiple images

## Alternative: Self-Hosted Embeddings

If you prefer not to use Replicate, you can:
1. Use OpenAI's CLIP API (requires OpenAI API key)
2. Self-host using Hugging Face models
3. Use Google's Vision API for image embeddings

However, Replicate provides the best balance of simplicity, cost, and performance for this use case.

## Next Steps

After configuring Replicate:
1. Test uploading an image to generate embeddings
2. Try searching with natural language queries
3. Monitor your Replicate dashboard for usage

## Support

- [Replicate Documentation](https://replicate.com/docs)
- [SigLIP Model Page](https://replicate.com/daanelson/siglip-large-patch16-384)
- [Replicate Discord](https://discord.gg/replicate)