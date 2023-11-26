---
title: 'How to Back Up Your Entire Slack Workspace'
description: 'How to go about backing up your entire Slack workspace'
pubDate: 'Nov 26 2023'
heroImage: '/blog-hero/andres-canchon-pP7EgaYDRKg-unsplash.jpg'
---

Everybody loves Slack. It's a great way to communiate with remote colleagues, or even with support communities. But what happens when you want to back up an entire Slack workspace?

Why would you want to back up Slack in the first place? Isn't it a managed service, making backups someone else's responsibilty? Well, yes, but... Some people don't want to completely depend on their service provider to store critical company data. What if Slack had an issue and all data for your organization were lost? Another compelling reason might be legal compliance - in some jurisdictions company correspondence needs to be stored for years. How can you make sure such corresponsdence is stored and remains accessible when needed for an audit? And if you (god forbid!) close a workspace, what happens to all its data?

Ok, so you decided to back up your entire Slack workspace. Having done this recently myself, I'll take you quickly through the steps I went through. It's not all for the feint of heart, so brace yourself!

# Ask for Your Data

First thing - you need to ask Slack for your workspace data. If you want *ALL* the data, including private chats and DMs, this doesn't come by default. You have to be on the Slack Business+ plan, and file an application in their export page. A few hours after I filed my request, I received an email from the Slack team, asking me to justify my request. This is perfectly logical and acceptable, since you wouldn't want everybody in your organization to just be able to ask the Slack team for the entire workspace data. Anyway, I had good answers to their questions, and emailed them back. The next morning I opened my email, and voilà - approved!

Next, I initiated the Slack export in their export page. This was fairly quick, and finished in just a few minutes, producing a 40MB ZIP file which I could download.

But wait, is my entire Slack workspace just 40MB? Of course not! This doesn't cover media attachments - only actual texts. If you open the ZIP file, you can see that it has a tree structure with ZIP files at the leaves, representing chat messages. Each message may have a `files` attributes, with media files attached. Each such file has many attributes, one of which is `url_private_download`. This URL, which includes an access token, can be used to download the actual file.

# Preparing to Archive in the Cloud

We'll get to obtaining the media files in a second. But since we're talking about potentially handling a lot of data now, it's a good time to stop and think what we want to do with this data anyway.

While this depends on your exact needs, I would turn to Google Cloud Storage in Archive mode as a good go-to method. In single-region mode, it comes at just $0.0012 per GB per month, which is about $10 for 100GB for 7 years. That's pretty reasonable!

In order not to have to drag many gigabytes of data to the to your local network and back, it's a good idea to run the actual backup from the cloud. Since we'll be using Google Cloud for archiving the data, why not also use a VM on Google Cloud Compute, to run the data transfer? In my case, I created a simple VM with an extra 100GB volume for handling the data. I marked the volume to be deleted upon VM termination.

For the work volume to be used, it first needs to be formatted and mounted. After connecting to the VM with SSH, this is what you need to do:

```bash
# List block devices. In my case, this showed that /dev/sdb is available, but not formatted or mounted
lsblk -f

# Format and mount the device
sudo mkfs -t ext4 /dev/sdb
sudo mkdir /mnt/mydisk
sudo mount /dev/sdb /mnt/mydisk
```

Next, upload the ZIP file received from Slack into the VM, and expand it into a subdirectory on the work volume:

```bash
sudo apt-get unzip
sudo mkdir /mnt/mydisk/slack

# Use your own username here
sudo chown oran /mnt/mydisk/slack
cd /mnt/mydisk/slack
unzip ~/slack-archive.zip
```


# Hacking the Media Downloads

Ok, so at this point, you need to run some sort of script that would actually download all the media attachments. It turns out that you shouldn't run many of these downloads together at the same time, as Slack will start to throttle them, and some will fail.

First, to just collect all the download URLs into a nice list, use the following Bash commands:

```bash
mkdir 000_media_files
find . -type f -name "*.json" -print0 | xargs -0 grep private_download  | grep -v canvases.json | cut -d'"' -f4 |  sed 's/\\//g' > 000_media_files/slack_file_urls.txt
```

If you examine this command closely, you will notice that we are excluding download links in files named `canvases.json`. This is because these files represent a special type of media attachment, called Canvas, which has a slightly different object format. In my case I had just a few of them, so there wasn't a need to automate their handling. If you do want to extract these files too, you need a slightly different `grep` command, plus additional parsing with `jq` to extract the URL. I'll leave that as an exercise.

Anwyway, now that we have the list of media URLs, all that remained is to download them. This can be done using the following shell script, courtesy of ChatGPT, which you can place in the user's home folder, and name `download-urls.sh`:

```bash
#!/bin/bash

while IFS= read -r url; do
    # Extract the path from the URL and replace each slash with '__'
    file_name=$(echo "$url" | sed -e 's~http[s]*://~~' -e 's~\?[^/]*~~' -e 's~/~__~g')

    # Download the content using wget
    wget -q -O "$file_name" "$url"

    if [ $? -eq 0 ]; then
        echo "Downloaded $url to $file_name"
    else
        echo "Failed to download $url"
    fi
done

```

This scripts turns the full URL into a long filename that preserves the path, which would be useful when actually trying to recover media related to a particular chat.

To run this script on the list of URLs created in the previous step:

```
cd 000_media_files
cat ./slack_file_urls.txt | bash ~/download-urls.sh
cd ../
```

After running this, I ended up with 20GB of data.

# Archiving in the Cloud

The last step is to simply copy this entire set of data to Google Cloud Storage.

First, you need to create a bucket in Google cloud storage. Be sure to use the `Archive` storage class for the bucket, and to select the region configuration you need.

To autenticate inside the VM, first authenticate by following instruction, then run the final command to upload the date:

```bash
gcloud auth login
gsutil -q -m cp -r . gs://your-bucket-name/
```

And that's all! Your Slack data is on Google for about the price of a bar of soap per year.
Don't forget to remove the VM from Google Cloud Compute, along with its data volume.

Happy backup!

Photo by <a href="https://unsplash.com/@bethewerewolf?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Andrés Canchón</a> on <a href="https://unsplash.com/photos/black-net-pP7EgaYDRKg?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>
  