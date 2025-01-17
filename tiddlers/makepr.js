/*\
title: $:/plugins/sq/makepr/startup.js
type: application/javascript
module-type: startup
\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "makepr-handler";
exports.platforms = ["browser"];
exports.after = ["startup"];

const REPO = "TiddlyWiki5",
	REPO_BRANCH = "tiddlywiki-com",
	STATUS_TITLE = "$:/state/makepr/prlink";

var getTiddlerPath = function(title) {
	var originalTiddlerPaths = JSON.parse($tw.wiki.getTiddlerText("$:/config/OriginalTiddlerPaths",{}));
	if(originalTiddlerPaths[title]) {
		return `editions/tw5.com/tiddlers/${originalTiddlerPaths[title]}`;
	} else {
		return `editions/tw5.com/tiddlers/${title}.tid`;
	}
}

var makepr = function(files,slug) {
	const MyOctokit = $tw.Octokit.plugin($tw.createPullRequest);
	const TOKEN = $tw.utils.getPassword("github");
	if(!TOKEN || !TOKEN.length) {
		alert("please set the github personal access token");
		return;
	}
	const octokit = new MyOctokit({
		auth: TOKEN,
	});
	
	// Returns a normal Octokit PR response
	// See https://octokit.github.io/rest.js/#octokit-routes-pulls-create
	const REPO_OWNER = $tw.wiki.getTiddlerText("$:/config/sq/makepr/repoOwner","jermolene");
	$tw.wiki.addTiddler(new $tw.Tiddler({title: STATUS_TITLE, text: `Creating PR...`}));
	octokit.createPullRequest({
		owner: REPO_OWNER,
		repo: REPO,
		title: $tw.wiki.getTiddlerText("$:/temp/pr-title"),
		body: $tw.wiki.getTiddlerText("$:/temp/pr-message"),
		base: REPO_BRANCH /* To Do: allow optionally specifying branch via UI */,
		head: `${slug}-${Math.floor(Date.now() / 1000)}`,
		changes: [
			{
			/* optional: if `files` is not passed, an empty commit is created instead */
				files: files,
				commit: $tw.wiki.getTiddlerText("$:/temp/pr-title"),
				emptyCommit : false,
			},
		],
		createWhenEmpty: false,
	})
	.then((pr) => {
	 	console.log(pr.data.number);
		$tw.wiki.addTiddler(new $tw.Tiddler({title: STATUS_TITLE, text:"PR created", link: `https://github.com/${REPO_OWNER}/${REPO}/pull/${pr.data.number}`}));
	}).catch((err)=>{
		$tw.wiki.addTiddler(new $tw.Tiddler({title: STATUS_TITLE, text: `There was an error in creating the PR. ${err}`}));		  
	});
}

exports.startup = function() {
	$tw.rootWidget.addEventListener("tm-makepr",function(event){
		var filter = event.param ||"",
			paramObject = event.paramObject || {},
			slug = paramObject.slug,
			tiddlersToUpload = $tw.wiki.filterTiddlers(filter,$tw.rootWidget),
			files = {};
		if(tiddlersToUpload.length) {
			$tw.utils.each(tiddlersToUpload,function(title){
				//check if tiddler exists?
				var tiddler = $tw.wiki.getTiddler(title);
				if(tiddler) {
					var path = getTiddlerPath(title),
						wikifyParser = $tw.wiki.parseText(tiddler.fields.type || "text/vnd.tiddlywiki",$tw.wiki.getTiddlerText("$:/core/templates/tid-tiddler"),{
							parseAsInline: false
						}),
						wikifyWidgetNode = $tw.wiki.makeWidget(wikifyParser,{
							document: $tw.fakeDocument,
							parentWidget: $tw.rootWidget,
							variables: {currentTiddler: title}
						}),
						wikifyContainer = $tw.fakeDocument.createElement("div"),
						tid;
					wikifyWidgetNode.render(wikifyContainer,null);
					tid = wikifyContainer.textContent;
					files[path] = tid;
				}
			});
			console.log(files);
			if(!$tw.Octokit) {
 			  	$tw.wiki.addTiddler(new $tw.Tiddler({title: STATUS_TITLE, text: `loading Octokit library`}));
				import("https://cdn.pika.dev/@octokit/core").then((module)=>{
					$tw.Octokit = module.Octokit;
					return import("https://cdn.pika.dev/octokit-plugin-create-pull-request");
				}).then((module)=>{
					$tw.createPullRequest = module.createPullRequest;
					makepr(files,slug);
				}).catch((err)=>{
					$tw.wiki.addTiddler(new $tw.Tiddler({title: STATUS_TITLE, text: `There was an error in creating the PR. ${err}`}));
				});
			} else {
				makepr(files,slug);
			}
		}
	});
};

})();