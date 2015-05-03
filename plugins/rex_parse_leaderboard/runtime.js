﻿// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
cr.plugins_.Rex_parse_Leaderboard = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var pluginProto = cr.plugins_.Rex_parse_Leaderboard.prototype;
		
	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	
	var typeProto = pluginProto.Type.prototype;

	typeProto.onCreate = function()
	{
	    jsfile_load("parse-1.3.2.min.js");
	};
	
	var jsfile_load = function(file_name)
	{
	    var scripts=document.getElementsByTagName("script");
	    var exist=false;
	    for(var i=0;i<scripts.length;i++)
	    {
	    	if(scripts[i].src.indexOf(file_name) != -1)
	    	{
	    		exist=true;
	    		break;
	    	}
	    }
	    if(!exist)
	    {
	    	var newScriptTag=document.createElement("script");
	    	newScriptTag.setAttribute("type","text/javascript");
	    	newScriptTag.setAttribute("src", file_name);
	    	document.getElementsByTagName("head")[0].appendChild(newScriptTag);
	    }
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
	};
	
	var instanceProto = pluginProto.Instance.prototype;

	instanceProto.onCreate = function()
	{ 	   
	    if (!window.RexC2IsParseInit)
	    {
	        window["Parse"]["initialize"](this.properties[0], this.properties[1]);
	        window.RexC2IsParseInit = true;
	    }
	    	     
	    if (!this.recycled)
	    {	    
	        this.rank_klass = window["Parse"].Object["extend"](this.properties[2]);
	    }
	    
	    var leaderboardID = this.properties[3];
	    var page_lines = this.properties[4]
	    this.ranking_order = this.properties[5];
	    this.acl_mode = this.properties[6];
	    this.user_class = this.properties[7];
	    
	    if (!this.recycled)
            this.leaderboard = this.create_leaderboard(page_lines);
        
        this.set_leaderBoardID(leaderboardID);

	    this.exp_CurPlayerRank = -1;
	    this.exp_CurRankCol = null;
	    this.exp_PostPlayerName = "";
        
        this.exp_LastRanking = -1;
        this.exp_LastUserID = "";   
        this.exp_LastUsersCount = -1;     
	};
	
	instanceProto.create_leaderboard = function(page_lines)
	{ 
	    var leaderboard = new window.ParseItemPageKlass(page_lines);
	    
	    var self = this;
	    var onReceived = function()
	    {
	        self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnUpdate, self);
	    }
	    leaderboard.onReceived = onReceived;
	    
	    var onGetIterItem = function(item, i)
	    {
	        self.exp_CurPlayerRank = i;
	        self.exp_CurRankCol = item;
	    };	    	    
	    leaderboard.onGetIterItem = onGetIterItem;
	    
	    return leaderboard;
	};	
    
	instanceProto.set_leaderBoardID = function(boardID, leaderboard)
	{ 
	    this.leaderBoardID = boardID;
	    
	    if (leaderboard == null)
	        leaderboard = this.leaderboard;
	    leaderboard.Reset();		
	};
    
	instanceProto.get_base_query = function(boardID, userID)
	{ 
	    var query = new window["Parse"]["Query"](this.rank_klass);
	    query["equalTo"]("boardID", boardID);
	    if (userID != null)
	        query["equalTo"]("userID", userID);
	    return query;
	};
	
	instanceProto.get_request_query = function(boardID)
	{ 
	    var query = this.get_base_query(boardID);       	   
        if (this.ranking_order==0)        
            query["ascending"]("score,updatedAt");        
        else        
            query["ascending"]("-score,updatedAt");        

        if (this.user_class !== "")
        {
            query["include"]("userObject");
        }
	    return query;
	};	
	//////////////////////////////////////
	// Conditions
	function Cnds() {};
	pluginProto.cnds = new Cnds();
	
	Cnds.prototype.OnPostComplete = function ()
	{
	    return true;
	}; 
	Cnds.prototype.OnPostError = function ()
	{
	    return true;
	}; 	 
	Cnds.prototype.OnUpdate = function ()
	{
	    return true;
	}; 
	Cnds.prototype.ForEachRank = function (start, end)
	{	            
		return this.leaderboard.ForEachItem(this.runtime, start, end);
	};   
	Cnds.prototype.OnGetRanking = function ()
	{
	    return true;
	}; 
	Cnds.prototype.OnGetRankingError = function ()
	{
	    return true;
	}; 	
	
	Cnds.prototype.OnGeUsersCount = function ()
	{
	    return true;
	}; 
	Cnds.prototype.OnGetUsersCountError = function ()
	{
	    return true;
	};		  
	//////////////////////////////////////
	// Actions
	function Acts() {};
	pluginProto.acts = new Acts();

    Acts.prototype.PostScore = function (userID, name, score, extra_data)
	{	
	    var self = this;
	    // step 3    
	    var OnPostComplete = function(rank_obj)
	    { 	        
            self.exp_PostPlayerName = name;
	        self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnPostComplete, self);
	    };	
	    
	    var OnPostError = function(rank_obj, error)
	    {
            self.exp_PostPlayerName = name;
	        self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnPostError, self);
	    };
	    	    
	    var save_rank = function(rank_obj)
	    {
	        rank_obj["set"]("boardID", self.leaderBoardID);
	        rank_obj["set"]("userID", userID);
	        rank_obj["set"]("name", name);
	        rank_obj["set"]("score", score);
	        rank_obj["set"]("extraData", extra_data);	
	        
	        if (self.acl_mode === 1)  // private
	        {
	            var current_user = window["Parse"]["User"]["current"]();
	            if (current_user)
	            {
	                var acl = new window["Parse"]["ACL"](current_user);
	                acl["setPublicReadAccess"](true);
	                rank_obj["setACL"](acl);
	            }
	        }
	        
	        if (self.user_class !== "")
	        {
	            var t = window["Parse"].Object["extend"](self.user_class);
	            var o = new t();
	            o["id"] = userID;
	            rank_obj["set"]("userObject", o);
	        }
	        
	        var handler = {"success":OnPostComplete, "error": OnPostError};
	        rank_obj["save"](null, handler);	        
	    };
	    
	    // step 2
	    var on_success = function(rank_obj)
	    {	 
	        if (!rank_obj)
	            rank_obj = new self.rank_klass();
	            
	        save_rank(rank_obj);
	    };	    
	    var on_error = function(error)
	    {
	        OnPostError(null, error);
	    };
        
	    // step 1
		var handler = {"success":on_success, "error": on_error};		
	    this.get_base_query(this.leaderBoardID, userID)["first"](handler); 
	}; 
	
    Acts.prototype.RequestInRange = function (start, lines)
	{
	    var query = this.get_request_query(this.leaderBoardID);
	    this.leaderboard.RequestInRange(query, start, lines);
	};

    Acts.prototype.RequestTurnToPage = function (page_index)
	{
	    var query = this.get_request_query(this.leaderBoardID);
	    this.leaderboard.RequestTurnToPage(query, page_index);
	};	 
    
    Acts.prototype.RequestUpdateCurrentPage = function ()
	{
	    var query = this.get_request_query(this.leaderBoardID);
	    this.leaderboard.RequestUpdateCurrentPage(query);
	};    
    
    Acts.prototype.RequestTurnToNextPage = function ()
	{
	    var query = this.get_request_query(this.leaderBoardID);
	    this.leaderboard.RequestTurnToNextPage(query);
	};     
    
    Acts.prototype.RequestTurnToPreviousPage = function ()
	{
	    var query = this.get_request_query(this.leaderBoardID);
	    this.leaderboard.RequestTurnToPreviousPage(query);
	};  
    
    Acts.prototype.SetLeaderboardID = function (leaderboardID)
	{
        this.set_leaderBoardID(leaderboardID);
	};

    Acts.prototype.GetRanking = function (userID)
	{	        
	    var start = 0;
	    var lines = 1000;
	    
        var self = this;
	    var on_success = function(rank_obj)
	    {	 
	        if (!rank_obj)
	        {
	            // page not found, cound not find userID
                self.exp_LastUserID = userID;
	            self.exp_LastRanking = -1;
	            self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnGetRankingError, self);
	        }
	        else
	        {
	            var ranking = -1;
	            var i, cnt = rank_obj.length;
	            for(i=0; i<cnt; i++)
	            {
	                if (rank_obj[i]["get"]("userID") === userID)
	                {
	                    // found ranking
	                    ranking = start + i;
	                    break;
	                }
	            }
	            
	            // cound not find userID in this page, try get next page
	            if (self.exp_LastRanking === -1)
	            {
	                start += lines;
	                query_page(start);
	            }
	            else
	            {
                    self.exp_LastUserID = userID;
	                self.exp_LastRanking = ranking;	                
	                self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnGetRanking, self);
	            }
	        }	            
	    };	    
	    var on_error = function(error)
	    {
	        // page not found, cound not find userID
            self.exp_LastUserID = userID;
	        self.exp_LastRanking = -1;
	        self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnGetRankingError, self);
	    };	    
	    var handler = {"success":on_success, "error": on_error};	
	    	    
	    var query_page = function (start_)
	    {
	        // get 1000 lines for each request until get null or get userID
	        var query = self.get_request_query(self.leaderBoardID);
            query["skip"](start_)["limit"](lines)["select"]("userID")["find"](handler);
        }
        
        query_page(start);
	}; 
	
    Acts.prototype.GetUsersCount = function ()
	{	    
	    var self = this;
	    var on_success = function(count)
	    {
	        self.exp_LastUsersCount = count;
	        self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnGeUsersCount, self); 	        
	    };	    
	    var on_error = function(error)
	    {      
	        self.exp_LastUsersCount = -1;
	        self.runtime.trigger(cr.plugins_.Rex_parse_Leaderboard.prototype.cnds.OnGetUsersCountError, self); 
	    };
	    
	    var handler = {"success":on_success, "error": on_error};    	     	    
	    this.get_request_query(self.leaderBoardID)["count"](handler);
	};	
	//////////////////////////////////////
	// Expressions
	function Exps() {};
	pluginProto.exps = new Exps();

	Exps.prototype.CurPlayerName = function (ret)
	{
	    var name;
	    if (this.exp_CurRankCol)
	        name = this.exp_CurRankCol["get"]("name");
	        
	    if (!name)
	        name = "";
	    
		ret.set_string( name );
	}; 	
	Exps.prototype.CurPlayerScore = function (ret)
	{
	    var score;
	    if (this.exp_CurRankCol)
	        score = this.exp_CurRankCol["get"]("score");
	        
	    if (!score)
	        score = 0;
	    
		ret.set_any( score );
	};
	Exps.prototype.CurPlayerRank = function (ret)
	{
		ret.set_int(this.exp_CurPlayerRank);
	};
	Exps.prototype.CurUserID = function (ret)
	{
	    var userID;
	    if (this.exp_CurRankCol)
	        userID = this.exp_CurRankCol["get"]("userID");
	        
	    if (!userID)
	        userID = "";
	    
		ret.set_string( userID );
	}; 	
	Exps.prototype.CurExtraData = function (ret)
	{
	    var v;
	    if (this.exp_CurRankCol)
	        v = this.exp_CurRankCol["get"]("extraData");
	        
	    if (!v)
	        v = "";
	    
		ret.set_any( v );
	};
	Exps.prototype.CurUserObject = function (ret, k_)
	{
	    var extra;
	    if (this.exp_CurRankCol)
	    {
	        var obj = this.exp_CurRankCol["get"]("userObject");
	        if (obj)
	            extra = obj["get"](k_);
	    }
	        
	    if (!extra)
	        extra = "";
	    
		ret.set_any( extra );
	};
		
	Exps.prototype.PostPlayerName = function (ret)
	{
		ret.set_string(this.exp_PostPlayerName);
	}; 	
	
	Exps.prototype.UserID2Rank = function (ret, userID)
	{
		ret.set_int(this.leaderboard.FindFirst("userID", userID));
	};
	   	
	Exps.prototype.Rank2PlayerName = function (ret, i, default_value)
	{
	    var rank_info = this.leaderboard.GetItem(i);
	    var name = (!rank_info)? null:rank_info["get"]("name");
        name = name || default_value || "";
		ret.set_string(name);
	};
	Exps.prototype.Rank2PlayerScore = function (ret, i, default_value)
	{
	    var rank_info = this.leaderboard.GetItem(i);    
	    var score = (!rank_info)? null:rank_info["get"]("score");
        score = score || default_value || 0;
		ret.set_any(score);
	};	
	Exps.prototype.Rank2ExtraData = function (ret, i, default_value)
	{
	    var rank_info = this.leaderboard.GetItem(i);	    
	    var extra_data = (!rank_info)? null:rank_info["get"]("extraData");
        extra_data = extra_data || default_value || "";
		ret.set_any(extra_data);
	};	
	Exps.prototype.Rank2PlayerUserID = function (ret, i, default_value)
	{
	    var rank_info = this.leaderboard.GetItem(i);	    
	    var userID = (!rank_info)? null:rank_info["get"]("userID");
        userID = userID || default_value || "";
		ret.set_string(userID);
	};	
	Exps.prototype.Rank2PlayerObject = function (ret, k, default_value)
	{
        var rank_info = this.leaderboard.GetItem(i);	
	    var v;
	    if (rank_info)
	    {
	        var obj = rank_info["get"]("userObject");
	        if (obj)
	            v = obj["get"](k_);
	    }
	        
	    if (!v)
	        v = default_value || "";
	    
		ret.set_any( v );
	};    
    
	Exps.prototype.PageIndex = function (ret)
	{
		ret.set_int(this.leaderboard.GetCurrentPageIndex());
	};    


	Exps.prototype.LastRanking = function (ret)
	{
		ret.set_int(this.exp_LastRanking);
	};	
	Exps.prototype.LastUserID = function (ret)
	{
		ret.set_string(this.exp_LastUserID);
	};	    
	
	Exps.prototype.LastUsersCount = function (ret)
	{
		ret.set_int(this.exp_LastUsersCount);
	};	
}());

(function ()
{
    if (window.ParseItemPageKlass != null)
        return;    

    var ItemPageKlass = function (page_lines)
    {
        // export
        this.onReceived = null;
        this.onGetIterItem = null;  // used in ForEachItem
        // export
	    this.items = [];
        this.start = 0;
        this.page_lines = page_lines;   
        this.page_index = 0;     
    };
    
    var ItemPageKlassProto = ItemPageKlass.prototype;  
     
	ItemPageKlassProto.Reset = function()
	{ 
	    this.items.length = 0;
        this.start = 0;     
	};	
	     
	ItemPageKlassProto.request = function(query, start, lines)
	{
        if (start < 0)
            start = 0;
            
        var self = this;
        
	    var on_success = function(items)
	    {
	        self.items = items;
            self.start = start;
            self.page_index = Math.floor(start/self.page_lines);
            
            if (self.onReceived)
                self.onReceived();
	    };	    
	    var on_error = function(error)
	    {
	        self.items.length = 0;        
	    };
	    
	    var handler = {"success":on_success, "error": on_error};
	    query["skip"](start);
        query["limit"](lines);	    
	    query["find"](handler);	    
	};	    

    ItemPageKlassProto.RequestInRange = function (query, start, lines)
	{
	    this.request(query, start, lines);
	};

    ItemPageKlassProto.RequestTurnToPage = function (query, page_index)
	{
	    var start = page_index*this.page_lines;
	    this.request(query, start, this.page_lines);
	};	 
    
    ItemPageKlassProto.RequestUpdateCurrentPage = function (query)
	{
	    this.request(query, this.start, this.page_lines);
	};    
    
    ItemPageKlassProto.RequestTurnToNextPage = function (query)
	{
        var start = this.start + this.page_lines;
	    this.request(query, start, this.page_lines);
	};     
    
    ItemPageKlassProto.RequestTurnToPreviousPage = function (query)
	{
        var start = this.start - this.page_lines;
	    this.request(query, start, this.page_lines);
	};  

	ItemPageKlassProto.ForEachItem = function (runtime, start, end)
	{
        var items_end = this.start + this.items.length - 1;       
	    if (start == null)
	        start = this.start; 
	    else
	        start = cr.clamp(start, this.start, items_end);
	        
	    if (end == null) 
	        end = items_end;
        else     
            end = cr.clamp(end, start, items_end);
        	    	     
        var current_frame = runtime.getCurrentEventStack();
        var current_event = current_frame.current_event;
		var solModifierAfterCnds = current_frame.isModifierAfterCnds();
		         
		var i;
		for(i=start; i<=end; i++)
		{
            if (solModifierAfterCnds)
            {
                runtime.pushCopySol(current_event.solModifiers);
            }
            
            if (this.onGetIterItem)
                this.onGetIterItem(this.GetItem(i), i);
                
            current_event.retrigger();
            
		    if (solModifierAfterCnds)
		    {
		        this.runtime.popSol(current_event.solModifiers);
		    }            
		}
    		
		return false;
	}; 

	ItemPageKlassProto.FindFirst = function(key, value, start_index)
	{
	    if (start_index == null)
	        start_index = 0;
	        
        var i, cnt=this.items.length;
        for(i=start_index; i<cnt; i++)
        {
            if (this.items[i]["get"](key) == value)
                return i + this.start;
        }
	    return -1;
	};
			
	ItemPageKlassProto.GetItem = function(i)
	{
	    return this.items[i - this.start];
	};
	
	ItemPageKlassProto.GetCurrentPageIndex = function ()
	{
	    return this.page_index;
	};	

	window.ParseItemPageKlass = ItemPageKlass;
}());                