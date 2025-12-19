#!/usr/bin/env python3
"""
Dataset Analysis Script for Leaf Disease Segmentation
Analyzes the structure and contents of the dataset to inform integration
"""

import os
import json
from pathlib import Path
from collections import defaultdict, Counter
import argparse

def analyze_dataset_structure(dataset_path):
    """Analyze the structure of the leaf disease segmentation dataset"""
    
    dataset_path = Path(dataset_path)
    if not dataset_path.exists():
        print(f"❌ Dataset path does not exist: {dataset_path}")
        return None
    
    print(f"🔍 Analyzing dataset at: {dataset_path}")
    
    analysis = {
        "dataset_path": str(dataset_path),
        "total_files": 0,
        "directories": [],
        "file_types": Counter(),
        "disease_classes": [],
        "image_files": [],
        "annotation_files": [],
        "structure": {}
    }
    
    # Walk through the dataset directory
    for root, dirs, files in os.walk(dataset_path):
        rel_path = os.path.relpath(root, dataset_path)
        
        # Track directory structure
        if rel_path != ".":
            analysis["directories"].append(rel_path)
        
        # Analyze files in current directory
        dir_info = {
            "path": rel_path,
            "files": [],
            "subdirs": dirs.copy()
        }
        
        for file in files:
            file_path = Path(root) / file
            file_ext = file_path.suffix.lower()
            
            analysis["total_files"] += 1
            analysis["file_types"][file_ext] += 1
            
            file_info = {
                "name": file,
                "extension": file_ext,
                "size": file_path.stat().st_size if file_path.exists() else 0
            }
            
            # Categorize files
            if file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
                analysis["image_files"].append(str(file_path))
                file_info["type"] = "image"
            elif file_ext in ['.json', '.xml', '.txt', '.csv']:
                analysis["annotation_files"].append(str(file_path))
                file_info["type"] = "annotation"
            else:
                file_info["type"] = "other"
            
            dir_info["files"].append(file_info)
        
        analysis["structure"][rel_path] = dir_info
    
    # Try to identify disease classes from directory structure
    potential_classes = []
    for dir_path in analysis["directories"]:
        # Look for directories that might represent disease classes
        parts = dir_path.split(os.sep)
        for part in parts:
            if part.lower() not in ['train', 'test', 'val', 'validation', 'images', 'masks', 'labels']:
                potential_classes.append(part)
    
    analysis["disease_classes"] = list(set(potential_classes))
    
    return analysis

def print_analysis_report(analysis):
    """Print a formatted analysis report"""
    
    print("\n" + "="*60)
    print("📊 DATASET ANALYSIS REPORT")
    print("="*60)
    
    print(f"\n📁 Dataset Location: {analysis['dataset_path']}")
    print(f"📈 Total Files: {analysis['total_files']}")
    print(f"📂 Total Directories: {len(analysis['directories'])}")
    
    print(f"\n🖼️  Image Files: {len(analysis['image_files'])}")
    print(f"📝 Annotation Files: {len(analysis['annotation_files'])}")
    
    print(f"\n📋 File Types:")
    for ext, count in analysis['file_types'].most_common():
        print(f"   {ext or 'no extension'}: {count} files")
    
    print(f"\n🦠 Potential Disease Classes:")
    if analysis['disease_classes']:
        for disease in sorted(analysis['disease_classes']):
            print(f"   - {disease}")
    else:
        print("   No obvious disease classes detected from directory structure")
    
    print(f"\n📁 Directory Structure:")
    for path, info in analysis['structure'].items():
        if path == ".":
            print(f"   📂 Root directory:")
        else:
            print(f"   📂 {path}:")
        
        if info['subdirs']:
            print(f"      Subdirectories: {', '.join(info['subdirs'])}")
        
        image_count = sum(1 for f in info['files'] if f.get('type') == 'image')
        annotation_count = sum(1 for f in info['files'] if f.get('type') == 'annotation')
        
        if image_count > 0:
            print(f"      Images: {image_count}")
        if annotation_count > 0:
            print(f"      Annotations: {annotation_count}")
        
        if len(info['files']) > 10:
            print(f"      ... and {len(info['files']) - 10} more files")
        elif info['files']:
            for file_info in info['files'][:5]:  # Show first 5 files
                print(f"      - {file_info['name']} ({file_info['type']})")
            if len(info['files']) > 5:
                print(f"      ... and {len(info['files']) - 5} more files")

def generate_integration_config(analysis):
    """Generate configuration for integrating the dataset"""
    
    config = {
        "dataset_info": {
            "name": "leaf_disease_segmentation",
            "path": analysis["dataset_path"],
            "total_images": len(analysis["image_files"]),
            "total_annotations": len(analysis["annotation_files"]),
            "disease_classes": analysis["disease_classes"]
        },
        "preprocessing": {
            "image_size": [224, 224],  # Standard for U-Net
            "normalization": "imagenet",  # Use ImageNet stats
            "augmentation": True
        },
        "training": {
            "batch_size": 16,
            "learning_rate": 0.001,
            "epochs": 50,
            "validation_split": 0.2
        }
    }
    
    return config

def main():
    parser = argparse.ArgumentParser(description="Analyze leaf disease segmentation dataset")
    parser.add_argument("dataset_path", help="Path to the dataset directory")
    parser.add_argument("--output", "-o", help="Output JSON file for analysis results")
    
    args = parser.parse_args()
    
    # Analyze the dataset
    analysis = analyze_dataset_structure(args.dataset_path)
    
    if analysis is None:
        return 1
    
    # Print the report
    print_analysis_report(analysis)
    
    # Generate integration config
    config = generate_integration_config(analysis)
    
    print(f"\n⚙️  Integration Configuration:")
    print(f"   - Image preprocessing: {config['preprocessing']['image_size']}")
    print(f"   - Disease classes detected: {len(config['dataset_info']['disease_classes'])}")
    print(f"   - Recommended batch size: {config['training']['batch_size']}")
    
    # Save results if requested
    if args.output:
        output_data = {
            "analysis": analysis,
            "config": config
        }
        
        with open(args.output, 'w') as f:
            json.dump(output_data, f, indent=2, default=str)
        
        print(f"\n💾 Analysis saved to: {args.output}")
    
    print(f"\n✅ Dataset analysis complete!")
    
    return 0

if __name__ == "__main__":
    exit(main())