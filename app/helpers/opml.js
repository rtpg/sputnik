'use strict';

var xmldoc = require('xmldoc');

exports.isOpml = function (fileContent) {
    var xml = new xmldoc.XmlDocument(fileContent);
    return xml.name === 'opml';
};

exports.import = function (fileContent, feedsStorage) {
    var xml = new xmldoc.XmlDocument(fileContent);
    
    function addFeed(xmlNode, categoryName) {
        if (!xmlNode.attr.xmlUrl) {
            return;
        }
        feedsStorage.addFeed({
            'url': xmlNode.attr.xmlUrl,
            'siteUrl': xmlNode.attr.htmlUrl,
            'title': xmlNode.attr.title || xmlNode.attr.text,
            'category': categoryName
        });
    }
    
    function addCategory(categoryNode, categoryName) {
        categoryNode.eachChild(function (subOutline) {
            if (subOutline.attr.type === 'rss') {
                // feed
                addFeed(subOutline, categoryName);
            } else if (subOutline.children.length > 0) {
                // subcategory
                // not supported in Sputnik, flatten it to main category
                addCategory(subOutline, categoryName);
            }
        });
    }
    
    if (xml.name === 'opml') {
        xml.childNamed('body').eachChild(function (outline) {
            if (outline.attr.type === 'rss') {
                // feed
                addFeed(outline, undefined);
            } else if (outline.children.length > 0) {
                // category
                var categoryName = outline.attr.title || outline.attr.text;
                addCategory(outline, categoryName);
            }
        });
    }
};

exports.export = function (feedsStorage) {
    
    function feedAttributes(xmlElement, feed) {
        xmlElement.att('text', feed.title || 'Feed');
        xmlElement.att('title', feed.title || 'Feed');
        xmlElement.att('type', 'rss');
        xmlElement.att('xmlUrl', feed.url);
        if (feed.siteUrl) {
            xmlElement.att('htmlUrl', feed.siteUrl);
        }
    }
    
    var builder = require('xmlbuilder');
    
    var categories = {};
    var uncategorizedFeeds = [];
    
    feedsStorage.feeds.forEach(function (feed) {
        if (feed.category) {
            if (!categories[feed.category]) {
                categories[feed.category] = [];
            }
            categories[feed.category].push(feed);
        } else {
            uncategorizedFeeds.push(feed);
        }
    });
    
    var root = builder.create('opml', { 'version': '1.0', 'encoding': 'UTF-8' }).att('version', '1.0');
    root.ele('head').ele('title', 'Subscriptions from Sputnik');
    var body = root.ele('body');
    Object.keys(categories).forEach(function (categoryName) {
        var element = body.ele('outline');
        element.att('title', categoryName);
        element.att('text', categoryName);
        categories[categoryName].forEach(function (feed) {
            var categoryElement = element.ele('outline');
            feedAttributes(categoryElement, feed);
        });
    });
    uncategorizedFeeds.forEach(function (feed) {
        var element = body.ele('outline');
        feedAttributes(element, feed);
    });
    
    return root.end({ pretty: true });
};