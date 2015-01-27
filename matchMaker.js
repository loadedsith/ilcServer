
var firebase = require('firebase');
var matchMaker = {};
matchMaker.matchList = {};
matchMaker.populateMatchList = function(user, usersSnapshot) {
  usersSnapshot.forEach(function(userRef) {
    var user = userRef.val();
    if (user.topics !== undefined) {
      // console.log('user with topics', user.topics);
      for (var ti = 0; ti < user.topics.length; ti++) {
        var topic = user.topics[ti];
        if (matchMaker.matchList[topic] === undefined) {
          matchMaker.matchList[topic] = [String(user.id)];
        } else {
          matchMaker.matchList[topic].push(String(user.id));
        }
      }
    } else {
      // console.log('user with no topics', user);
      if (matchMaker.matchList['no-topic'] === undefined) {
        matchMaker.matchList['no-topic'] = [String(user.id||user.data['user_id'])];
      } else {
        matchMaker.matchList['no-topic'].push(String(user.id||user.data['user_id']));
      }
    }
    // console.log('Matched matchList', matchMaker.matchList);
  });
  return matchMaker.matchList;
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
  return matchMaker.matchList;
};

matchMaker.getMatchList = function(user, usersSnapshot) {
  matchMaker.matchList = {};
  matchMaker.populateMatchList(user, usersSnapshot);
  matchMaker.blacklistMatchList(user, usersSnapshot);
  return matchMaker.matchList;
};


module.exports=matchMaker;