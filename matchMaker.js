
var firebase = require('firebase');
var matchMaker = {};
matchMaker.matchList = {};
matchMaker.populateMatchList = function(inUser, usersSnapshot) {
  usersSnapshot.forEach(function(userRef) {
    var user = userRef.val();
    var userId = user.id||user.data['user_id'];
    if ((user.profile||{}).interests !== undefined) {
      // console.log('user with profile.interests', user.profile.interests);
      for (var ti = 0; ti < user.profile.interests.length; ti++) {
        var interest = user.profile.interests[ti];
        console.log('inUser.data[\'user_id\']', inUser.data['user_id']);
        console.log('userId', userId);
        if (String(inUser.id) !== String(userId)) {
          //Skip yourself son
          if (matchMaker.matchList[interest] === undefined) {
            matchMaker.matchList[interest] = [{id:String(userId),profile:(user.profile||null)}];
          } else {
            matchMaker.matchList[interest].push({id:String(userId),profile:(user.profile||null)});
          }
        }
      }
    } else {
      if (String(inUser.id) !== String(userId)) {
        if (matchMaker.matchList['no-topic'] === undefined) {
          matchMaker.matchList['no-topic'] = [{id:String(user.id||user.data['user_id']),profile:(user.profile||null)}];
        } else {
          matchMaker.matchList['no-topic'].push({id:String(user.id||user.data['user_id']),profile:(user.profile||null)});
        }
      }
    }
  });
};
matchMaker.blacklistMatchList = function(user) {
  var topics = (user.topics || ['debug topics'])
  var blacklist = (user.blacklist || ['debug blacklist'])
  for (var ti = topics.length - 1; ti >= 0; ti--) {
    var topic = topics[ti];
    //start with all the user's topics
    var matchesForTopic = matchMaker.matchList[topic];
    //if there are any results for this topic
    if (matchesForTopic !== undefined) {
      //go through the black list
      for (var bi = blacklist.length - 1; bi >= 0; bi--) {
        var blacklisted = blacklist[bi];
        //a flag to remove the topic if needed
        var itIsBlacklisted = false;
        for (var i = matchesForTopic.length - 1; i >= 0; i--) {
          var matchForTopic = matchesForTopic[i];

          if(String(user.id) === String(matchForTopic)){
            itIsBlacklisted = true;
          }

          //go through the matched topic's user ids
          if (String(blacklisted) === String(matchForTopic)) {
            //flag this matchForTopic for removal
            // console.log('blacklisted flagged for removal', blacklisted, 'for topic: ' + topic);
            itIsBlacklisted = true;
          }
        }
        //now that we arent looping over the topics,
        // check if the current blacklist object should be removed from the matches
        if (itIsBlacklisted === true) {
          // remove blacklist object from match topic
          matchesForTopic.pop(blacklisted);
        }
      }
    }
  }
  console.log('matchMaker.matchlist', matchMaker.matchlist);
};

matchMaker.getMatchList = function(user, usersSnapshot) {
  matchMaker.matchList = {};
  console.log('get match list for user',user);
  matchMaker.populateMatchList(user, usersSnapshot);
  matchMaker.blacklistMatchList(user, usersSnapshot);
  return matchMaker.matchList;
};


module.exports=matchMaker;