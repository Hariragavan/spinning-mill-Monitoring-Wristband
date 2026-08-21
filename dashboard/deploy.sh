#!/bin/bash
# Quick Vercel Deployment Script

echo "🚀 Spinning Mill Dashboard - Vercel Deployment"
echo "=============================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Navigate to dashboard
cd "$(dirname "$0")"

echo "📝 Environment Setup"
echo "1. Copy .env.example to .env.local"
echo "2. Fill in your Firebase credentials"
echo ""

if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found!"
    echo "   Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "   ✏️  Please edit .env.local with your Firebase credentials"
fi

echo ""
echo "🔐 Vercel Login"
vercel login

echo ""
echo "🚀 Deploying to Vercel..."
vercel

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📌 Next steps:"
echo "1. Go to your Vercel dashboard"
echo "2. Add environment variables in Project Settings"
echo "3. Redeploy from Vercel dashboard"
echo "4. Test API endpoints:"
echo "   - GET /api/health"
echo "   - GET /api/workers"
echo "   - GET /api/worker/worker_1"
