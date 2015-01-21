
var firebase = require('firebase');
var matchMaker = {};
matchMaker.matchList = {};
matchMaker.populateMatchList = function(user, usersSnapshot) {
  usersSnapshot.forEach(function(userRef) {
    var user = userRef.val();
    if (user.topics !== undefined) {
      console.log('user with topics', user.topics);
      for (var ti = 0; ti < user.topics.length; ti++) {
        var topic = user.topics[ti];
        if (matchMaker.matchList[topic] === undefined) {
          matchMaker.matchList[topic] = [String(user.id)];
        } else {
          matchMaker.matchList[topic].push(String(user.id));
        }
      }
    } else {
      console.log('user with no topics', user);
      if (matchMaker.matchList['no-topic'] === undefined) {
        matchMaker.matchList['no-topic'] = [String(user.id||user.data['user_id'])];
      } else {
        matchMaker.matchList['no-topic'].push(String(user.id||user.data['user_id']));
      }
    }
    console.log('Matched matchList', matchMaker.matchList);
  });
  return matchMaker.matchList;
};
module.exports=matchMaker;